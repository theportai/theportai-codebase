import requests # type: ignore
from colorama import init, Fore, Style # type: ignore

# Initialize colorama for cross-platform colored terminal output
init()

def simulate_request(ip, endpoint="/health", method="GET", data=None):
    """Simulate a request with a specific IP address."""
    headers = {
        "X-Forwarded-For": ip,  # simulate client IP
        "Content-Type": "application/json"
    }
    
    url = f"http://127.0.0.1:8000{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=5)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=5)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        status_text = f"{Fore.GREEN}Allowed{Style.RESET_ALL}" if response.status_code == 200 else f"{Fore.RED}Blocked ({response.status_code}){Style.RESET_ALL}"
        print(f"🔎 IP: {ip} | Status: {status_text}")
        
        # Try to get JSON response, fallback to text if not JSON
        try:
            response_data = response.json()
            print(f"Response: {response_data}")
        except:
            if response.text:
                print(f"Response: {response.text[:100]}...")
        
        return response.status_code
    except requests.exceptions.RequestException as e:
        print(f"{Fore.RED}❌ Error contacting server from IP {ip}: {e}{Style.RESET_ALL}")
        return None

def run_ip_pen_tests():
    print(f"\n{Fore.CYAN}🧪 [PenTest] Starting IP Whitelist Simulation...{Style.RESET_ALL}\n")
    
    results = []
    
    # Test case 1: Localhost IP (should be allowed)
    print(f"{Fore.CYAN}Test 1: Allowed IP (127.0.0.1){Style.RESET_ALL}")
    status_code = simulate_request("127.0.0.1")
    expected = "Allowed"
    actual = "Allowed" if status_code == 200 else f"Blocked ({status_code})"
    result = expected == actual
    results.append((result, "127.0.0.1", expected, actual))
    print("-" * 50)
    
    # Test case 2: External IP (should be blocked)
    print(f"{Fore.CYAN}Test 2: Disallowed IP (8.8.8.8 - Google DNS){Style.RESET_ALL}")
    status_code = simulate_request("8.8.8.8")
    expected = "Blocked (403)"
    actual = "Allowed" if status_code == 200 else f"Blocked ({status_code})"
    result = expected == actual
    results.append((result, "8.8.8.8", expected, actual))
    print("-" * 50)
    
    # Test case 3: Internal but unapproved IP
    print(f"{Fore.CYAN}Test 3: Disallowed IP (10.0.0.99){Style.RESET_ALL}")
    status_code = simulate_request("10.0.0.99")
    expected = "Blocked (403)"
    actual = "Allowed" if status_code == 200 else f"Blocked ({status_code})"
    result = expected == actual
    results.append((result, "10.0.0.99", expected, actual))
    print("-" * 50)
    
    # Test case 4: POST to endpoint from blocked IP
    print(f"{Fore.CYAN}Test 4: POST to /generate-token from blocked IP{Style.RESET_ALL}")
    status_code = simulate_request("8.8.8.8", endpoint="/generate-token", method="POST", 
                                 data={"agent_name": "sentiment_agent"})
    expected = "Blocked (403)"
    actual = "Allowed" if status_code == 200 else f"Blocked ({status_code})"
    result = expected == actual
    results.append((result, "POST with blocked IP", expected, actual))
    
    # Print summary table
    print(f"\n{Fore.CYAN}📊 Test Results Summary:{Style.RESET_ALL}")
    print("-" * 60)
    print(f"{'Test':<5} | {'IP':<20} | {'Expected':<15} | {'Result':<15}")
    print("-" * 60)
    
    for i, (result, ip, expected, actual) in enumerate(results, 1):
        status_icon = f"{Fore.GREEN}✅{Style.RESET_ALL}" if result else f"{Fore.RED}❌{Style.RESET_ALL}"
        print(f"{status_icon:<5} | {ip:<20} | {expected:<15} | {actual:<15}")
    
    # Overall test summary
    success_count = sum(1 for r in results if r[0])
    print("-" * 60)
    print(f"\n{Fore.CYAN}Summary: {success_count}/{len(results)} tests passed{Style.RESET_ALL}")
    print(f"\n{Fore.CYAN}✅ [PenTest] IP Whitelist Simulation Completed.{Style.RESET_ALL}\n")

if __name__ == "__main__":
    run_ip_pen_tests()