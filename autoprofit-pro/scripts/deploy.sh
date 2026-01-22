#!/bin/bash
# deploy.sh - AutoProfit Pro Full Stack Deployment

set -e

echo "🚀 Starting AutoProfit Pro Deployment..."

# Colors for output
RED='33[0;31m'
GREEN='33[0;32m'
YELLOW='33[1;33m'
NC='33[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
DOCKER_COMPOSE_FILE="infrastructure/docker-compose.yml"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Function for logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed!"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f ".env" ]; then
        log_warn ".env file not found, creating from example..."
        cp .env.example .env
        log_warn "Please edit .env file with your configuration!"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

# Backup existing data
backup_data() {
    log_info "Creating backup of existing data..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    docker exec autoprofit-db pg_dump -U autoprofit_user autoprofit > "$BACKUP_DIR/database_backup.sql"
    
    # Backup uploaded files
    if [ -d "./uploads" ]; then
        cp -r ./uploads "$BACKUP_DIR/uploads"
    fi
    
    # Backup AI models
    if [ -d "./ai_models" ]; then
        cp -r ./ai_models "$BACKUP_DIR/ai_models"
    fi
    
    log_info "Backup created at: $BACKUP_DIR"
}

# Stop existing services
stop_services() {
    log_info "Stopping existing services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down || true
}

# Build and start services
start_services() {
    log_info "Building and starting services..."
    
    # Build images
    log_info "Building Docker images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    log_info "Checking service health..."
    
    services=(
        "autoprofit-db:5432"
        "autoprofit-redis:6379"
        "autoprofit-api:8000"
        "autoprofit-z-ai:8001"
        "autoprofit-web:3000"
    )
    
    for service in "${services[@]}"; do
        host=$(echo "$service" | cut -d':' -f1)
        port=$(echo "$service" | cut -d':' -f2)
        
        if docker-compose -f "$DOCKER_COMPOSE_FILE" exec "$host" nc -z localhost "$port" 2>/dev/null; then
            log_info "$host is healthy ✓"
        else
            log_warn "$host is not responding, checking logs..."
            docker-compose -f "$DOCKER_COMPOSE_FILE" logs "$host"
        fi
    done
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec api \
        python -m alembic upgrade head
    
    log_info "Database migrations completed ✓"
}

# Initialize AI models
initialize_ai_models() {
    log_info "Initializing AI models..."
    
    # Wait for Z.ai service to be ready
    until curl -s http://localhost:8001/health > /dev/null; do
        log_info "Waiting for Z.ai service..."
        sleep 5
    done
    
    # Initialize models
    curl -X POST http://localhost:8001/api/z-ai/models/initialize \
        -H "Content-Type: application/json" \
        -d '{"workshop_id": "default"}'
    
    log_info "AI models initialized ✓"
}

# Create initial admin user
create_admin_user() {
    log_info "Creating initial admin user..."
    
    ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@autoprofit.pro"}
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-$(openssl rand -base64 12)}
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec api \
        python -c "
import sys
sys.path.append('/app')
from src.core.database import SessionLocal
from src.models import User, Workshop
from src.core.security import get_password_hash

db = SessionLocal()

# Create default workshop if not exists
workshop = db.query(Workshop).filter(Workshop.name == 'Default Workshop').first()
if not workshop:
    workshop = Workshop(
        name='Default Workshop',
        owner_name='Admin',
        currency='SAR',
        language='ar'
    )
    db.add(workshop)
    db.commit()
    db.refresh(workshop)

# Create admin user
admin = db.query(User).filter(User.email == '$ADMIN_EMAIL').first()
if not admin:
    admin = User(
        workshop_id=workshop.id,
        username='admin',
        email='$ADMIN_EMAIL',
        full_name='System Administrator',
        role='owner',
        hashed_password=get_password_hash('$ADMIN_PASSWORD'),
        is_active=True,
        is_verified=True
    )
    db.add(admin)
    db.commit()
    print(f'Admin user created: $ADMIN_EMAIL / $ADMIN_PASSWORD')
else:
    print('Admin user already exists')
db.close()
"
    
    log_info "Admin user created successfully ✓"
    log_warn "Admin credentials: $ADMIN_EMAIL / $ADMIN_PASSWORD"
    log_warn "Please change the password immediately!"
}

# Display deployment information
display_deployment_info() {
    log_info "🚀 AutoProfit Pro Deployment Complete!"
    echo ""
    echo "📊 Services Status:"
    echo "  PostgreSQL:      http://localhost:5432"
    echo "  Redis:           http://localhost:6379"
    echo "  API Server:      http://localhost:8000"
    echo "  Z.ai Engine:     http://localhost:8001"
    echo "  Web Interface:   http://localhost:3000"
    echo "  API Docs:        http://localhost:8000/api/docs"
    echo "  Grafana:         http://localhost:3001"
    echo ""
    echo "🔧 Management Commands:"
    echo "  View logs:       docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo "  Stop services:   docker-compose -f $DOCKER_COMPOSE_FILE down"
    echo "  Restart:         docker-compose -f $DOCKER_COMPOSE_FILE restart"
    echo "  Backup:          ./scripts/backup.sh"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Access http://localhost:3000"
    echo "  2. Login with admin credentials"
    echo "  3. Configure your workshop settings"
    echo "  4. Import initial data (optional)"
    echo ""
}

# Main deployment process
main() {
    log_info "Starting AutoProfit Pro deployment for $ENVIRONMENT environment"
    
    # Run deployment steps
    check_prerequisites
    backup_data
    stop_services
    start_services
    run_migrations
    initialize_ai_models
    create_admin_user
    display_deployment_info
    
    log_info "Deployment completed successfully! 🎉"
}

# Run main function
main "$@"
