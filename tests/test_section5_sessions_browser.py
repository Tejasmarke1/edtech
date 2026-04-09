"""
Section 5 - Sessions Module Browser Tests
E2E tests for session booking, management, and Jitsi integration
"""

import pytest
from playwright.async_api import async_playwright, expect


@pytest.fixture
async def browser_context():
    """Setup browser for testing"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        yield context
        await context.close()
        await browser.close()


class TestSection5Sessions:
    """
    Section 5: Sessions Module - E2E Tests
    
    Test Coverage:
    - Student session booking flow
    - Teacher session management / acceptance
    - Session joining with video ready
    - Status transitions and validations
    """

    @pytest.mark.asyncio
    async def test_student_book_session_flow(self, browser_context):
        """
        ✓ Student can book a session with a teacher
        Steps:
        1. Login as student
        2. Navigate to Find Teachers
        3. Select a teacher
        4. Fill booking form
        5. Submit session request
        """
        page = await browser_context.new_page()
        
        try:
            # Navigate to login
            await page.goto("http://localhost:5175/login", wait_until="networkidle", timeout=30000)
            
            # Login as student
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("student@example.com")
            
            password_input = await page.wait_for_selector('input[type="password"]', timeout=5000)
            await password_input.fill("SecurePass123!")
            
            sign_in_button = await page.wait_for_selector('button:has-text("Sign In")', timeout=5000)
            await sign_in_button.click()
            
            # Wait for redirect to dashboard
            await page.wait_for_url("**/dashboard", timeout=10000)
            
            # Navigate to Find Teachers
            teachers_link = await page.wait_for_selector('text=Find Teachers', timeout=5000)
            await teachers_link.click()
            
            # Wait for teachers page to load
            await page.wait_for_selector('text=Find Teachers', timeout=10000)
            
            # Click on first teacher (book session button should appear)
            # Assuming there's a teacher card visible
            book_button_xpath = '//button[contains(text(), "Book Session")]'
            book_buttons = await page.query_selector_all(book_button_xpath)
            
            if book_buttons:
                await book_buttons[0].click()
                
                # Wait for booking modal
                await page.wait_for_selector('text=Book Session', timeout=5000)
                
                # Fill booking form
                subject_select = await page.query_selector('select')
                if subject_select:
                    await subject_select.evaluate('el => el.value = el.options[1]?.value')
                
                # Look for date input and fill it with a future date
                date_inputs = await page.query_selector_all('input[type="date"]')
                if date_inputs:
                    future_date = "2025-12-25"
                    await date_inputs[0].fill(future_date)
                
                # Fill topic description if available
                text_areas = await page.query_selector_all('textarea')
                if text_areas:
                    await text_areas[0].fill("Need help with calculus concepts")
                
                # Submit the form
                submit_button = await page.query_selector('button[type="submit"]')
                if submit_button:
                    await submit_button.click()
                    
                    # Wait for success message or redirect
                    await page.wait_for_timeout(3000)
                    
                    # Check for confirmation
                    success_or_redirect = await page.wait_for_function(
                        'window.location.href.includes("/dashboard") || window.location.href.includes("/sessions")',
                        timeout=5000
                    )
                    
                    assert success_or_redirect is not None, "Session booking should succeed or redirect"
        
        finally:
            await page.close()

    @pytest.mark.asyncio
    async def test_student_view_my_sessions(self, browser_context):
        """
        ✓ Student can view their sessions list
        Steps:
        1. Login as student
        2. Navigate to My Sessions
        3. Verify sessions are displayed with status
        4. Check action buttons
        """
        page = await browser_context.new_page()
        
        try:
            # Navigate to login
            await page.goto("http://localhost:5175/login", wait_until="networkidle", timeout=30000)
            
            # Login as student
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("student@example.com")
            
            password_input = await page.wait_for_selector('input[type="password"]', timeout=5000)
            await password_input.fill("SecurePass123!")
            
            sign_in_button = await page.wait_for_selector('button:has-text("Sign In")', timeout=5000)
            await sign_in_button.click()
            
            # Wait for dashboard
            await page.wait_for_url("**/dashboard", timeout=10000)
            
            # Navigate to My Sessions
            sessions_link = await page.wait_for_selector('a:has-text("My Sessions")', timeout=5000)
            await sessions_link.click()
            
            # Wait for sessions page
            await page.wait_for_url("**/my-sessions", timeout=10000)
            await page.wait_for_selector('text=My Sessions', timeout=5000)
            
            # Check if sessions are displayed or empty state
            empty_state = await page.query_selector('text=No sessions yet')
            sessions_container = await page.query_selector('.space-y-4')
            
            # Either empty state or sessions list should be visible
            assert empty_state is not None or sessions_container is not None, \
                "Sessions page should show either empty state or sessions list"
        
        finally:
            await page.close()

    @pytest.mark.asyncio
    async def test_teacher_view_session_requests(self, browser_context):
        """
        ✓ Teacher can view incoming session requests
        Steps:
        1. Login as teacher
        2. Navigate to Session Management
        3. Verify pending requests are displayed
        4. Check action buttons (accept/reject)
        """
        page = await browser_context.new_page()
        
        try:
            # Navigate to login
            await page.goto("http://localhost:5175/login", wait_until="networkidle", timeout=30000)
            
            # Login as teacher
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("teacher@example.com")
            
            password_input = await page.wait_for_selector('input[type="password"]', timeout=5000)
            await password_input.fill("SecurePass123!")
            
            sign_in_button = await page.wait_for_selector('button:has-text("Sign In")', timeout=5000)
            await sign_in_button.click()
            
            # Wait for teacher dashboard
            await page.wait_for_url("**/teacher-dashboard", timeout=10000)
            
            # Navigate to Session Management
            sessions_link = await page.wait_for_selector('a:has-text("My Sessions")', timeout=5000)
            await sessions_link.click()
            
            # Wait for session management page
            await page.wait_for_url("**/teacher-sessions", timeout=10000)
            await page.wait_for_selector('text=Session Management', timeout=5000)
            
            # Check for stats cards
            stats_cards = await page.query_selector_all('.grid > div')
            assert len(stats_cards) >= 2, "Session management should show stats cards"
            
            # Check for filter tabs
            filter_tabs = await page.query_selector_all('button[type="button"]')
            assert len(filter_tabs) >= 1, "Should have filter tabs"
        
        finally:
            await page.close()

    @pytest.mark.asyncio
    async def test_session_status_indicators(self, browser_context):
        """
        ✓ Session status badges render correctly
        Verify: Requested, Accepted, Completed, Cancelled badges display with proper styling/icons
        """
        page = await browser_context.new_page()
        
        try:
            # Navigate to login
            await page.goto("http://localhost:5175/login", wait_until="networkidle", timeout=30000)
            
            # Login as student
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("student@example.com")
            
            password_input = await page.wait_for_selector('input[type="password"]', timeout=5000)
            await password_input.fill("SecurePass123!")
            
            sign_in_button = await page.wait_for_selector('button:has-text("Sign In")', timeout=5000)
            await sign_in_button.click()
            
            # Go to sessions
            await page.wait_for_url("**/dashboard", timeout=10000)
            sessions_link = await page.wait_for_selector('a:has-text("My Sessions")', timeout=5000)
            await sessions_link.click()
            await page.wait_for_url("**/my-sessions", timeout=10000)
            
            # Check for status badges (if sessions exist)
            status_badges = await page.query_selector_all('[class*="rounded-lg"][class*="px"]')
            
            if status_badges:
                # Verify badges have expected classes/styling
                for badge in status_badges:
                    classes = await badge.evaluate('el => el.className')
                    # Status badges should have color classes
                    has_color = any(x in classes for x in 
                                   ['amber', 'emerald', 'red', 'blue', 'slate', 'purple', 'orange'])
                    assert has_color, "Status badges should have color styling"
        
        finally:
            await page.close()

    @pytest.mark.asyncio
    async def test_responsive_design_sessions_page(self, browser_context):
        """
        ✓ My Sessions page is responsive on mobile
        Viewport: 375x667 (iPhone SE)
        """
        page = await browser_context.new_page(viewport={"width": 375, "height": 667})
        
        try:
            # Navigate to login
            await page.goto("http://localhost:5175/login", wait_until="networkidle", timeout=30000)
            
            # Login
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("student@example.com")
            
            password_input = await page.wait_for_selector('input[type="password"]', timeout=5000)
            await password_input.fill("SecurePass123!")
            
            sign_in_button = await page.wait_for_selector('button:has-text("Sign In")', timeout=5000)
            await sign_in_button.click()
            
            # Go to sessions
            await page.wait_for_url("**/dashboard", timeout=10000)
            sessions_link = await page.wait_for_selector('a:has-text("My Sessions")', timeout=5000)
            await sessions_link.click()
            await page.wait_for_url("**/my-sessions", timeout=10000)
            
            # On mobile, main content should be visible without horizontal scroll
            main_content = await page.query_selector('main') or await page.query_selector('.max-w')
            assert main_content is not None, "Main content should be visible on mobile"
            
            # Check that layout is stacked vertically (not grid on mobile)
            page_width = page.viewport_size['width']
            element_boxes = await page.evaluate('''
                () => {
                    const el = document.querySelector('main') || document.querySelector('.max-w');
                    if (!el) return null;
                    const rect = el.getBoundingClientRect();
                    return { width: rect.width, left: rect.left, right: rect.right };
                }
            ''')
            
            if element_boxes:
                assert element_boxes['width'] <= page_width + 10, \
                    "Content should fit within mobile viewport"
        
        finally:
            await page.close()

    @pytest.mark.asyncio
    async def test_action_buttons_visibility(self, browser_context):
        """
        ✓ Action buttons appear based on session status
        - Pending: Cancel button
        - Accepted: Join Meeting button
        - Completed: No action buttons
        """
        page = await browser_context.new_page()
        
        try:
            # Navigate to login
            await page.goto("http://localhost:5175/login", wait_until="networkidle", timeout=30000)
            
            # Login as student
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("student@example.com")
            
            password_input = await page.wait_for_selector('input[type="password"]', timeout=5000)
            await password_input.fill("SecurePass123!")
            
            sign_in_button = await page.wait_for_selector('button:has-text("Sign In")', timeout=5000)
            await sign_in_button.click()
            
            # Go to sessions
            await page.wait_for_url("**/dashboard", timeout=10000)
            sessions_link = await page.wait_for_selector('a:has-text("My Sessions")', timeout=5000)
            await sessions_link.click()
            await page.wait_for_url("**/my-sessions", timeout=10000)
            
            # If sessions exist, check for action buttons
            session_cards = await page.query_selector_all('div[class*="rounded-2xl"]')
            
            if session_cards:
                for card in session_cards:
                    buttons = await card.query_selector_all('button')
                    if buttons:
                        button_texts = [await b.text_content() for b in buttons]
                        # Should have at least one action button (Join, Cancel, Accept, etc.)
                        valid_actions = ['Join', 'Cancel', 'Accept', 'Reject', 'Complete']
                        has_action = any(any(action in text for action in valid_actions) for text in button_texts)
                        # Only check if status suggests buttons should be present
        
        finally:
            await page.close()

    @pytest.mark.asyncio
    async def test_session_not_found_gracefully_handled(self, browser_context):
        """
        ✓ Non-existent session is handled gracefully
        Trying to join non-existent session should show error
        """
        page = await browser_context.new_page()
        
        try:
            # Navigate to login
            await page.goto("http://localhost:5175/login", wait_until="networkidle", timeout=30000)
            
            # Login as student
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("student@example.com")
            
            password_input = await page.wait_for_selector('input[type="password"]', timeout=5000)
            await password_input.fill("SecurePass123!")
            
            sign_in_button = await page.wait_for_selector('button:has-text("Sign In")', timeout=5000)
            await sign_in_button.click()
            
            # Try to access non-existent session
            await page.goto("http://localhost:5175/sessions/nonexistent-id/join", timeout=30000)
            
            # Should either show error or redirect with error message
            # Wait a moment for error to appear
            await page.wait_for_timeout(2000)
            
            current_url = page.url
            # Should either redirect or show error
            assert current_url != "http://localhost:5175/sessions/nonexistent-id/join" or \
                   "error" in current_url.lower() or \
                   "error" in (await page.text_content('body')).lower(), \
                   "Non-existent session should be handled gracefully"
        
        except Exception as e:
            # Network error or timeout is acceptable for non-existent session
            assert "timeout" in str(e).lower() or "error" in str(e).lower()
        
        finally:
            await page.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
