"""
WhatsApp Service - Unified WhatsApp Messaging Service
Supports both Twilio API (for automatic sending) and Deeplink fallback
"""
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import uuid
import random
import urllib.parse

class WhatsAppService:
    """
    WhatsApp messaging service with dual mode:
    1. Twilio API mode (automatic sending) - if credentials provided
    2. Deeplink mode (manual sending) - fallback
    """
    
    def __init__(self, db):
        self.db = db
        self.twilio_enabled = False
        self.twilio_client = None
        self.twilio_from = None
        
        # Check if Twilio credentials are available
        self._init_twilio()
    
    def _init_twilio(self):
        """Initialize Twilio client if credentials are available"""
        try:
            account_sid = os.getenv('TWILIO_ACCOUNT_SID')
            auth_token = os.getenv('TWILIO_AUTH_TOKEN')
            whatsapp_from = os.getenv('TWILIO_WHATSAPP_FROM')
            
            if account_sid and auth_token and whatsapp_from:
                from twilio.rest import Client
                self.twilio_client = Client(account_sid, auth_token)
                self.twilio_from = whatsapp_from
                self.twilio_enabled = True
                print("✅ Twilio WhatsApp enabled")
            else:
                print("⚠️ Twilio credentials not found - using deeplink mode")
        except ImportError:
            print("⚠️ Twilio package not installed - using deeplink mode")
        except Exception as e:
            print(f"⚠️ Twilio initialization failed: {e}")
    
    def normalize_phone(self, phone: str) -> str:
        """Normalize phone number to international format (966...)"""
        norm = ''.join([c for c in phone if c.isdigit()])
        
        # Add Saudi country code if missing
        if norm.startswith('05') or norm.startswith('5'):
            if norm.startswith('0'):
                norm = '966' + norm[1:]
            else:
                norm = '966' + norm
        elif not norm.startswith('966'):
            norm = '966' + norm
        
        return norm
    
    async def send_message(
        self, 
        to_phone: str, 
        message: str, 
        message_type: str = 'general',
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send WhatsApp message (automatically via Twilio or deeplink)
        
        Args:
            to_phone: Recipient phone number
            message: Message text
            message_type: Type of message (otp, approval, document, general)
            metadata: Additional data to store with message
        
        Returns:
            Dict with status, message_id, and delivery info
        """
        normalized_phone = self.normalize_phone(to_phone)
        message_id = str(uuid.uuid4())
        
        # Create message record
        message_record = {
            'id': message_id,
            'to_phone': normalized_phone,
            'message': message,
            'type': message_type,
            'status': 'pending',
            'delivery_method': 'twilio' if self.twilio_enabled else 'deeplink',
            'metadata': metadata or {},
            'created_at': datetime.utcnow(),
            'sent_at': None,
            'delivered_at': None,
            'error': None
        }
        
        try:
            if self.twilio_enabled:
                # Send via Twilio
                result = await self._send_via_twilio(normalized_phone, message)
                message_record['status'] = result['status']
                message_record['sent_at'] = datetime.utcnow()
                message_record['twilio_sid'] = result.get('sid')
                message_record['error'] = result.get('error')
            else:
                # Generate deeplink
                result = await self._generate_deeplink(normalized_phone, message)
                message_record['status'] = 'deeplink_generated'
                message_record['whatsapp_deeplink'] = result['deeplink']
            
            # Store message record
            await self.db.whatsapp_messages.insert_one(message_record)
            
            return {
                'success': True,
                'message_id': message_id,
                'delivery_method': message_record['delivery_method'],
                'status': message_record['status'],
                'whatsapp_deeplink': result.get('deeplink'),
                'twilio_sid': result.get('sid')
            }
            
        except Exception as e:
            message_record['status'] = 'failed'
            message_record['error'] = str(e)
            await self.db.whatsapp_messages.insert_one(message_record)
            
            return {
                'success': False,
                'message_id': message_id,
                'error': str(e)
            }
    
    async def _send_via_twilio(self, to_phone: str, message: str) -> Dict[str, Any]:
        """Send message via Twilio WhatsApp API"""
        try:
            twilio_message = self.twilio_client.messages.create(
                from_=f'whatsapp:{self.twilio_from}',
                body=message,
                to=f'whatsapp:+{to_phone}'
            )
            
            return {
                'status': 'sent',
                'sid': twilio_message.sid
            }
        except Exception as e:
            return {
                'status': 'failed',
                'error': str(e)
            }
    
    async def _generate_deeplink(self, to_phone: str, message: str) -> Dict[str, Any]:
        """Generate WhatsApp deeplink"""
        encoded_message = urllib.parse.quote(message)
        deeplink = f"https://wa.me/{to_phone}?text={encoded_message}"
        
        return {
            'status': 'deeplink_generated',
            'deeplink': deeplink
        }
    
    async def send_otp(self, phone: str, code: str) -> Dict[str, Any]:
        """Send OTP code via WhatsApp"""
        message = f"رمز التحقق للدخول: {code}\nهذا الرمز صالح لمدة 5 دقائق."
        
        return await self.send_message(
            to_phone=phone,
            message=message,
            message_type='otp',
            metadata={'code': code}
        )
    
    async def send_approval_request(
        self, 
        phone: str, 
        customer_name: str,
        title: str,
        amount: float,
        approval_link: str
    ) -> Dict[str, Any]:
        """Send approval request via WhatsApp"""
        message = (
            f"السلام عليكم {customer_name}\n\n"
            f"📋 {title}\n"
            f"💰 المبلغ المتوقع: {amount} ر.س\n\n"
            f"للاعتماد أو الرفض:\n{approval_link}"
        )
        
        return await self.send_message(
            to_phone=phone,
            message=message,
            message_type='approval',
            metadata={
                'customer_name': customer_name,
                'title': title,
                'amount': amount,
                'link': approval_link
            }
        )
    
    async def send_document(
        self,
        phone: str,
        customer_name: str,
        document_type: str,
        vehicle_plate: str,
        tracking_link: str
    ) -> Dict[str, Any]:
        """Send document (invoice, diagnosis, quote, receipt) via WhatsApp"""
        
        doc_names = {
            'invoice': 'الفاتورة',
            'diagnosis': 'تقرير التشخيص',
            'quote': 'عرض السعر',
            'receipt': 'سند القبض'
        }
        
        doc_name = doc_names.get(document_type, 'المستند')
        
        message = (
            f"السلام عليكم {customer_name}\n\n"
            f"📄 {doc_name}\n"
            f"🚗 المركبة: {vehicle_plate}\n\n"
            f"للاطلاع:\n{tracking_link}"
        )
        
        return await self.send_message(
            to_phone=phone,
            message=message,
            message_type='document',
            metadata={
                'customer_name': customer_name,
                'document_type': document_type,
                'vehicle_plate': vehicle_plate,
                'link': tracking_link
            }
        )
    
    async def get_message_status(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get status of sent message"""
        message = await self.db.whatsapp_messages.find_one({'id': message_id})
        if not message:
            return None
        
        message.pop('_id', None)
        if message.get('created_at'):
            message['created_at'] = message['created_at'].isoformat()
        if message.get('sent_at'):
            message['sent_at'] = message['sent_at'].isoformat()
        if message.get('delivered_at'):
            message['delivered_at'] = message['delivered_at'].isoformat()
        
        return message
    
    async def get_messages(
        self,
        phone: Optional[str] = None,
        message_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> list:
        """Get list of sent messages with filters"""
        query = {}
        
        if phone:
            normalized = self.normalize_phone(phone)
            query['to_phone'] = normalized
        
        if message_type:
            query['type'] = message_type
        
        if status:
            query['status'] = status
        
        messages = await self.db.whatsapp_messages.find(query).sort('created_at', -1).limit(limit).to_list(length=limit)
        
        for msg in messages:
            msg.pop('_id', None)
            if msg.get('created_at'):
                msg['created_at'] = msg['created_at'].isoformat()
            if msg.get('sent_at'):
                msg['sent_at'] = msg['sent_at'].isoformat()
            if msg.get('delivered_at'):
                msg['delivered_at'] = msg['delivered_at'].isoformat()
        
        return messages
