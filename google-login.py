"""
One-time Google login — saves session cookies for Playwright to reuse.
Run this once, sign into Google in the browser window, then close it.
"""

from playwright.sync_api import sync_playwright
import os

SESSION_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.google-session')

def main():
    print("A browser will open. Sign into your Google account.")
    print("After signing in, close the browser window.")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
            SESSION_DIR,
            headless=False,
            args=[
                '--disable-blink-features=AutomationControlled',
            ],
        )

        page = browser.pages[0] if browser.pages else browser.new_page()
        page.goto('https://accounts.google.com')

        print("Waiting for you to sign in... Close the browser when done.")
        page.wait_for_event('close', timeout=0)
        browser.close()

    print(f"\nSession saved to: {SESSION_DIR}")
    print("You can now use the virtual-camera-server.py to create meetings.")

if __name__ == '__main__':
    main()
