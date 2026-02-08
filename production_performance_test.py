#!/usr/bin/env python3
"""
Production Performance Testing for https://fixsa.online
اختبار الأداء على بيئة الإنتاج

Tests 30 repeated requests for each endpoint and measures:
- Response times (min/avg/max)
- Error rates
- 5xx errors and timeouts
- Connection issues
"""

import asyncio
import aiohttp
import time
import statistics
from datetime import datetime
from typing import List, Dict, Any
import json

# Production domain
BASE_URL = "https://fixsa.online"

# Test endpoints
ENDPOINTS = [
    {
        "name": "GET /api/vehicles",
        "url": f"{BASE_URL}/api/vehicles",
        "method": "GET"
    },
    {
        "name": "GET /api/technicians", 
        "url": f"{BASE_URL}/api/technicians",
        "method": "GET"
    },
    {
        "name": "GET /api/settings",
        "url": f"{BASE_URL}/api/settings", 
        "method": "GET"
    },
    {
        "name": "GET /api/finance/ar/customers",
        "url": f"{BASE_URL}/api/finance/ar/customers?workshop_id=finmodule-sync&as_of=2026-02-08&include_today=true",
        "method": "GET"
    },
    {
        "name": "GET /api/vehicles/{id}/visits",
        "url": f"{BASE_URL}/api/vehicles/f3422cc1-dd9c-4e69-8205-0aa50b3795a1/visits",
        "method": "GET"
    }
]

# Number of requests per endpoint
REQUESTS_PER_ENDPOINT = 30
REQUEST_TIMEOUT = 30  # seconds

class PerformanceResult:
    def __init__(self, endpoint_name: str):
        self.endpoint_name = endpoint_name
        self.response_times: List[float] = []
        self.status_codes: List[int] = []
        self.errors: List[str] = []
        self.timeouts: int = 0
        self.connection_errors: int = 0
        self.server_errors: int = 0  # 5xx errors
        
    def add_result(self, response_time: float, status_code: int = None, error: str = None):
        if error:
            self.errors.append(error)
            if "timeout" in error.lower():
                self.timeouts += 1
            elif "connection" in error.lower() or "refused" in error.lower():
                self.connection_errors += 1
        else:
            self.response_times.append(response_time)
            self.status_codes.append(status_code)
            if status_code >= 500:
                self.server_errors += 1
    
    def get_stats(self) -> Dict[str, Any]:
        if not self.response_times:
            return {
                "endpoint": self.endpoint_name,
                "total_requests": REQUESTS_PER_ENDPOINT,
                "successful_requests": 0,
                "error_rate": 100.0,
                "response_times": {
                    "min": None,
                    "avg": None,
                    "max": None,
                    "median": None
                },
                "errors": {
                    "total": len(self.errors),
                    "timeouts": self.timeouts,
                    "connection_errors": self.connection_errors,
                    "server_errors": self.server_errors
                },
                "status_codes": {},
                "error_details": self.errors[:5]  # First 5 errors
            }
        
        # Calculate statistics
        min_time = min(self.response_times)
        max_time = max(self.response_times)
        avg_time = statistics.mean(self.response_times)
        median_time = statistics.median(self.response_times)
        
        # Count status codes
        status_code_counts = {}
        for code in self.status_codes:
            status_code_counts[code] = status_code_counts.get(code, 0) + 1
        
        successful_requests = len(self.response_times)
        error_rate = (len(self.errors) / REQUESTS_PER_ENDPOINT) * 100
        
        return {
            "endpoint": self.endpoint_name,
            "total_requests": REQUESTS_PER_ENDPOINT,
            "successful_requests": successful_requests,
            "error_rate": round(error_rate, 2),
            "response_times": {
                "min": round(min_time, 3),
                "avg": round(avg_time, 3),
                "max": round(max_time, 3),
                "median": round(median_time, 3)
            },
            "errors": {
                "total": len(self.errors),
                "timeouts": self.timeouts,
                "connection_errors": self.connection_errors,
                "server_errors": self.server_errors
            },
            "status_codes": status_code_counts,
            "error_details": self.errors[:5]  # First 5 errors
        }

async def test_endpoint(session: aiohttp.ClientSession, endpoint: Dict[str, str]) -> PerformanceResult:
    """Test a single endpoint with multiple requests"""
    result = PerformanceResult(endpoint["name"])
    
    print(f"🔄 Testing {endpoint['name']} ({REQUESTS_PER_ENDPOINT} requests)...")
    
    for i in range(REQUESTS_PER_ENDPOINT):
        start_time = time.time()
        
        try:
            async with session.request(
                endpoint["method"],
                endpoint["url"],
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
            ) as response:
                # Read response to ensure complete request
                await response.read()
                
                response_time = time.time() - start_time
                result.add_result(response_time, response.status)
                
                # Print progress every 10 requests
                if (i + 1) % 10 == 0:
                    print(f"  ✅ Completed {i + 1}/{REQUESTS_PER_ENDPOINT} requests")
                    
        except asyncio.TimeoutError:
            response_time = time.time() - start_time
            result.add_result(response_time, error=f"Timeout after {REQUEST_TIMEOUT}s")
            print(f"  ⏰ Request {i + 1} timed out")
            
        except aiohttp.ClientConnectorError as e:
            response_time = time.time() - start_time
            result.add_result(response_time, error=f"Connection error: {str(e)}")
            print(f"  🔌 Request {i + 1} connection error")
            
        except Exception as e:
            response_time = time.time() - start_time
            result.add_result(response_time, error=f"Error: {str(e)}")
            print(f"  ❌ Request {i + 1} error: {str(e)}")
        
        # Small delay between requests to avoid overwhelming the server
        await asyncio.sleep(0.1)
    
    return result

async def run_performance_tests():
    """Run performance tests on all endpoints"""
    print(f"🚀 Starting Production Performance Test")
    print(f"📍 Target: {BASE_URL}")
    print(f"📊 Requests per endpoint: {REQUESTS_PER_ENDPOINT}")
    print(f"⏱️  Timeout: {REQUEST_TIMEOUT}s")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = []
    
    # Configure session with reasonable settings
    connector = aiohttp.TCPConnector(
        limit=10,  # Max connections
        limit_per_host=5,  # Max connections per host
        ttl_dns_cache=300,  # DNS cache TTL
        use_dns_cache=True,
    )
    
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
    
    async with aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        headers={
            "User-Agent": "PerformanceTest/1.0",
            "Accept": "application/json"
        }
    ) as session:
        
        for endpoint in ENDPOINTS:
            try:
                result = await test_endpoint(session, endpoint)
                results.append(result)
                
                # Print immediate results
                stats = result.get_stats()
                print(f"\n📈 {endpoint['name']} Results:")
                if stats['successful_requests'] > 0:
                    print(f"  ✅ Success Rate: {100 - stats['error_rate']:.1f}%")
                    print(f"  ⏱️  Response Times: {stats['response_times']['min']}s / {stats['response_times']['avg']}s / {stats['response_times']['max']}s (min/avg/max)")
                else:
                    print(f"  ❌ All requests failed")
                
                if stats['errors']['total'] > 0:
                    print(f"  🚨 Errors: {stats['errors']['total']} total")
                    if stats['errors']['timeouts'] > 0:
                        print(f"    ⏰ Timeouts: {stats['errors']['timeouts']}")
                    if stats['errors']['connection_errors'] > 0:
                        print(f"    🔌 Connection Errors: {stats['errors']['connection_errors']}")
                    if stats['errors']['server_errors'] > 0:
                        print(f"    🔥 Server Errors (5xx): {stats['errors']['server_errors']}")
                
                print("-" * 40)
                
            except Exception as e:
                print(f"❌ Failed to test {endpoint['name']}: {str(e)}")
                # Create a failed result
                failed_result = PerformanceResult(endpoint["name"])
                for _ in range(REQUESTS_PER_ENDPOINT):
                    failed_result.add_result(0, error=f"Test setup error: {str(e)}")
                results.append(failed_result)
    
    return results

def analyze_results(results: List[PerformanceResult]) -> Dict[str, Any]:
    """Analyze all results and generate comprehensive report"""
    
    all_stats = [result.get_stats() for result in results]
    
    # Find slowest endpoints
    slowest_endpoints = []
    for stats in all_stats:
        if stats['response_times']['max'] is not None:
            slowest_endpoints.append({
                "endpoint": stats['endpoint'],
                "max_time": stats['response_times']['max'],
                "avg_time": stats['response_times']['avg']
            })
    
    slowest_endpoints.sort(key=lambda x: x['max_time'], reverse=True)
    
    # Find most problematic endpoints
    problematic_endpoints = []
    for stats in all_stats:
        if stats['error_rate'] > 0:
            problematic_endpoints.append({
                "endpoint": stats['endpoint'],
                "error_rate": stats['error_rate'],
                "errors": stats['errors']
            })
    
    problematic_endpoints.sort(key=lambda x: x['error_rate'], reverse=True)
    
    # Overall statistics
    total_requests = sum(stats['total_requests'] for stats in all_stats)
    total_successful = sum(stats['successful_requests'] for stats in all_stats)
    total_errors = total_requests - total_successful
    overall_error_rate = (total_errors / total_requests) * 100 if total_requests > 0 else 0
    
    # Collect all response times for overall stats
    all_response_times = []
    for result in results:
        all_response_times.extend(result.response_times)
    
    overall_response_stats = None
    if all_response_times:
        overall_response_stats = {
            "min": round(min(all_response_times), 3),
            "avg": round(statistics.mean(all_response_times), 3),
            "max": round(max(all_response_times), 3),
            "median": round(statistics.median(all_response_times), 3)
        }
    
    # Check for connection issues patterns
    connection_issues = []
    restart_indicators = []
    
    for stats in all_stats:
        if stats['errors']['connection_errors'] > 5:  # More than 5 connection errors
            connection_issues.append({
                "endpoint": stats['endpoint'],
                "connection_errors": stats['errors']['connection_errors']
            })
        
        # Look for patterns that might indicate restarts
        if stats['errors']['connection_errors'] > 0 and stats['errors']['timeouts'] > 0:
            restart_indicators.append({
                "endpoint": stats['endpoint'],
                "connection_errors": stats['errors']['connection_errors'],
                "timeouts": stats['errors']['timeouts']
            })
    
    return {
        "test_summary": {
            "total_requests": total_requests,
            "successful_requests": total_successful,
            "failed_requests": total_errors,
            "overall_error_rate": round(overall_error_rate, 2),
            "overall_response_times": overall_response_stats
        },
        "endpoint_details": all_stats,
        "slowest_endpoints": slowest_endpoints[:5],  # Top 5 slowest
        "problematic_endpoints": problematic_endpoints,
        "connection_issues": connection_issues,
        "restart_indicators": restart_indicators
    }

def print_final_report(analysis: Dict[str, Any]):
    """Print comprehensive final report"""
    
    print("\n" + "=" * 80)
    print("🏁 FINAL PERFORMANCE REPORT")
    print("=" * 80)
    
    # Test Summary
    summary = analysis["test_summary"]
    print(f"\n📊 OVERALL SUMMARY:")
    print(f"  Total Requests: {summary['total_requests']}")
    print(f"  Successful: {summary['successful_requests']}")
    print(f"  Failed: {summary['failed_requests']}")
    print(f"  Success Rate: {100 - summary['overall_error_rate']:.1f}%")
    
    if summary['overall_response_times']:
        times = summary['overall_response_times']
        print(f"  Response Times: {times['min']}s / {times['avg']}s / {times['max']}s (min/avg/max)")
    
    # Slowest Endpoints
    print(f"\n🐌 SLOWEST ENDPOINTS (Top 5):")
    if analysis["slowest_endpoints"]:
        for i, endpoint in enumerate(analysis["slowest_endpoints"], 1):
            print(f"  {i}. {endpoint['endpoint']}")
            print(f"     Max: {endpoint['max_time']}s, Avg: {endpoint['avg_time']}s")
    else:
        print("  No successful requests to analyze")
    
    # Problematic Endpoints
    print(f"\n🚨 PROBLEMATIC ENDPOINTS:")
    if analysis["problematic_endpoints"]:
        for endpoint in analysis["problematic_endpoints"]:
            print(f"  ❌ {endpoint['endpoint']} - {endpoint['error_rate']}% error rate")
            errors = endpoint['errors']
            if errors['timeouts'] > 0:
                print(f"     ⏰ Timeouts: {errors['timeouts']}")
            if errors['connection_errors'] > 0:
                print(f"     🔌 Connection Errors: {errors['connection_errors']}")
            if errors['server_errors'] > 0:
                print(f"     🔥 Server Errors (5xx): {errors['server_errors']}")
    else:
        print("  ✅ No problematic endpoints detected")
    
    # Connection Issues Analysis
    print(f"\n🔍 CONNECTION ISSUES ANALYSIS:")
    if analysis["connection_issues"]:
        print("  🚨 High connection error rates detected:")
        for issue in analysis["connection_issues"]:
            print(f"    - {issue['endpoint']}: {issue['connection_errors']} connection errors")
    
    if analysis["restart_indicators"]:
        print("  ⚠️  Possible restart/backpressure indicators:")
        for indicator in analysis["restart_indicators"]:
            print(f"    - {indicator['endpoint']}: {indicator['connection_errors']} conn errors + {indicator['timeouts']} timeouts")
        print("  💡 Suggestion: This pattern may indicate server restarts or backpressure issues")
    
    if not analysis["connection_issues"] and not analysis["restart_indicators"]:
        print("  ✅ No significant connection issues detected")
    
    # Detailed Endpoint Results
    print(f"\n📋 DETAILED ENDPOINT RESULTS:")
    for stats in analysis["endpoint_details"]:
        print(f"\n  🎯 {stats['endpoint']}")
        print(f"     Requests: {stats['successful_requests']}/{stats['total_requests']} successful ({100-stats['error_rate']:.1f}%)")
        
        if stats['response_times']['min'] is not None:
            times = stats['response_times']
            print(f"     Times: {times['min']}s / {times['avg']}s / {times['max']}s (min/avg/max)")
        
        if stats['errors']['total'] > 0:
            print(f"     Errors: {stats['errors']['total']} total")
            if stats['error_details']:
                print(f"     Sample: {stats['error_details'][0]}")

async def main():
    """Main function to run the performance test"""
    try:
        # Run the tests
        results = await run_performance_tests()
        
        # Analyze results
        analysis = analyze_results(results)
        
        # Print final report
        print_final_report(analysis)
        
        # Save detailed results to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"/app/production_performance_results_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 Detailed results saved to: {filename}")
        print(f"🕐 Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return analysis
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())