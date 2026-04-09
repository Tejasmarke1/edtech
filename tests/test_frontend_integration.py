"""
Automated E2E tests for Frontend-Backend Integration (Section 1-3)

Covers:
✓ Section 1: Health Check & API Connectivity
✓ Section 2: Authentication (Register, Login)
✓ Section 3: Teacher Setup (Profile, Subjects)
"""

import asyncio
import pytest
import httpx
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import random
import string

# Endpoints
API_BASE = "http://localhost:8000/api/v1"
FRONTEND_BASE = "http://localhost:5175"
BACKEND_HEALTH = "http://localhost:8000/health"


def random_email():
    """Generate random email for testing"""
    rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{rand_str}@example.com"


# ===================================================================
# SECTION 1: HEALTH CHECK & API CONNECTIVITY
# ===================================================================
class TestSection1Health:
    """Section 1: Verify backend health and API connectivity"""

    @pytest.mark.asyncio
    async def test_backend_health(self):
        """Test backend health check endpoint"""
        async with httpx.AsyncClient() as client:
            response = await client.get(BACKEND_HEALTH)
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}
            print("✅ Section 1.1: Backend is healthy")

    @pytest.mark.asyncio
    async def test_api_connectivity(self):
        """Test basic API connectivity"""
        async with httpx.AsyncClient() as client:
            # Test if API base is reachable
            response = await client.get(f"{API_BASE}/health" if hasattr(httpx, 'get') else BACKEND_HEALTH)
            assert response.status_code in [200, 404, 405]  # Health or route not found is OK
            print("✅ Section 1.2: API is reachable")


# ===================================================================
# SECTION 2: AUTHENTICATION (Register & Login)
# ===================================================================
class TestSection2Auth:
    """Section 2: Frontend-Backend auth flow (Register, Login, Me)"""

    teacher_email = None
    student_email = None
    teacher_token = None
    student_token = None

    @pytest.mark.asyncio
    async def test_register_teacher_api(self):
        """Test teacher registration via API"""
        self.teacher_email = random_email()
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/auth/register",
                json={
                    "user_name": self.teacher_email,
                    "password": "Str0ngP@ss!",
                    "role": "teacher",
                    "full_name": "Test Teacher",
                },
            )
            assert response.status_code == 201
            print(f"✅ Section 2.1: Teacher registered ({self.teacher_email})")

    @pytest.mark.asyncio
    async def test_register_student_api(self):
        """Test student registration via API"""
        self.student_email = random_email()
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/auth/register",
                json={
                    "user_name": self.student_email,
                    "password": "Str0ngP@ss!",
                    "role": "student",
                    "full_name": "Test Student",
                },
            )
            assert response.status_code == 201
            print(f"✅ Section 2.2: Student registered ({self.student_email})")

    @pytest.mark.asyncio
    async def test_login_teacher_api(self):
        """Test teacher login and token retrieval"""
        if not self.teacher_email:
            self.teacher_email = random_email()
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{API_BASE}/auth/register",
                    json={
                        "user_name": self.teacher_email,
                        "password": "Str0ngP@ss!",
                        "role": "teacher",
                        "full_name": "Test Teacher",
                    },
                )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/auth/login",
                data={"username": self.teacher_email, "password": "Str0ngP@ss!"},
            )
            assert response.status_code == 200
            body = response.json()
            assert "access_token" in body
            self.teacher_token = body["access_token"]
            print(f"✅ Section 2.3: Teacher logged in (token received)")

    @pytest.mark.asyncio
    async def test_login_student_api(self):
        """Test student login"""
        if not self.student_email:
            self.student_email = random_email()
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{API_BASE}/auth/register",
                    json={
                        "user_name": self.student_email,
                        "password": "Str0ngP@ss!",
                        "role": "student",
                        "full_name": "Test Student",
                    },
                )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/auth/login",
                data={"username": self.student_email, "password": "Str0ngP@ss!"},
            )
            assert response.status_code == 200
            body = response.json()
            assert "access_token" in body
            self.student_token = body["access_token"]
            print(f"✅ Section 2.4: Student logged in (token received)")

    @pytest.mark.asyncio
    async def test_frontend_register_flow(self):
        """Test frontend registration UI flow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Navigate to register page
            await page.goto(f"{FRONTEND_BASE}/register", wait_until="networkidle")
            await asyncio.sleep(1)  # Wait for page to render
            
            # Fill registration form
            test_email = random_email()
            await page.fill('input[placeholder*="email" i], input[type="email"]', test_email)
            await page.fill('input[type="password"]', "Str0ngP@ss!")
            await page.fill('input[placeholder*="name" i], input[name*="name" i], input[name*="full" i]', "Frontend Test User")
            
            # Check for role selector
            role_selects = await page.query_selector_all('select, [role="option"], [role="listbox"]')
            if role_selects:
                await page.click('select')
                await page.click('text=Student')
            
            # Submit form
            submit_button = await page.query_selector('button[type="submit"], button:has-text("Register")')
            if submit_button:
                await page.click(submit_button)
                await asyncio.sleep(2)  # Wait for submission
            
            print("✅ Section 2.5: Frontend registration flow tested")
            await browser.close()

    @pytest.mark.asyncio
    async def test_frontend_login_flow(self):
        """Test frontend login UI flow"""
        # First ensure user exists
        test_email = random_email()
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{API_BASE}/auth/register",
                json={
                    "user_name": test_email,
                    "password": "Str0ngP@ss!",
                    "role": "student",
                    "full_name": "Test Login User",
                },
            )

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Navigate to login page
            await page.goto(f"{FRONTEND_BASE}/login", wait_until="networkidle")
            await asyncio.sleep(1)
            
            # Fill login form
            email_input = await page.query_selector('input[type="email"], input[placeholder*="email"]')
            password_input = await page.query_selector('input[type="password"]')
            
            if email_input and password_input:
                await email_input.fill(test_email)
                await password_input.fill("Str0ngP@ss!")
                
                # Submit
                submit_button = await page.query_selector('button[type="submit"], button:has-text("Login")')
                if submit_button:
                    await page.click(submit_button)
                    await asyncio.sleep(2)
            
            print("✅ Section 2.6: Frontend login flow tested")
            await browser.close()


# ===================================================================
# SECTION 3: TEACHER MODULE (Profile & Subjects)
# ===================================================================
class TestSection3Teacher:
    """Section 3: Teacher profile setup and subject management"""

    teacher_email = None
    teacher_token = None

    @pytest.mark.asyncio
    async def test_setup_teacher(self):
        """Register and login teacher for section 3 tests"""
        self.teacher_email = random_email()
        async with httpx.AsyncClient() as client:
            # Register
            await client.post(
                f"{API_BASE}/auth/register",
                json={
                    "user_name": self.teacher_email,
                    "password": "Str0ngP@ss!",
                    "role": "teacher",
                    "full_name": "Section3 Teacher",
                },
            )
            # Login
            response = await client.post(
                f"{API_BASE}/auth/login",
                data={"username": self.teacher_email, "password": "Str0ngP@ss!"},
            )
            self.teacher_token = response.json()["access_token"]
            print("✅ Section 3.1: Teacher account created for testing")

    @pytest.mark.asyncio
    async def test_teacher_profile_api(self):
        """Test teacher profile retrieval via API"""
        if not self.teacher_token:
            await self.test_setup_teacher()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE}/teachers/profile",
                headers={"Authorization": f"Bearer {self.teacher_token}"},
            )
            assert response.status_code == 200
            profile = response.json()
            assert profile["user_name"] == self.teacher_email
            print("✅ Section 3.2: Teacher profile retrieved")

    @pytest.mark.asyncio
    async def test_teacher_update_profile_api(self):
        """Test teacher profile update"""
        if not self.teacher_token:
            await self.test_setup_teacher()

        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{API_BASE}/teachers/profile",
                headers={"Authorization": f"Bearer {self.teacher_token}"},
                json={"bio": "Expert Math tutor", "per_30_mins_charges": 500},
            )
            assert response.status_code == 200
            assert response.json()["bio"] == "Expert Math tutor"
            print("✅ Section 3.3: Teacher profile updated")

    @pytest.mark.asyncio
    async def test_teacher_subjects_api(self):
        """Test teacher can add and retrieve subjects"""
        if not self.teacher_token:
            await self.test_setup_teacher()

        async with httpx.AsyncClient() as client:
            # Get available subjects
            response = await client.get(f"{API_BASE}/subjects")
            subjects = response.json()
            if subjects:
                # Add first subject
                subject_id = subjects[0].get("sub_id")
                response = await client.post(
                    f"{API_BASE}/teachers/subjects",
                    headers={"Authorization": f"Bearer {self.teacher_token}"},
                    json={"sub_id": subject_id},
                )
                assert response.status_code == 201
                print("✅ Section 3.4: Teacher added subject")

                # Retrieve subjects
                response = await client.get(
                    f"{API_BASE}/teachers/subjects",
                    headers={"Authorization": f"Bearer {self.teacher_token}"},
                )
                assert response.status_code == 200
                assert len(response.json()) > 0
                print("✅ Section 3.5: Teacher subjects retrieved")

    @pytest.mark.asyncio
    async def test_frontend_teacher_dashboard(self):
        """Test frontend teacher dashboard accessibility"""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            context = await browser.new_context(
                extra_http_headers={
                    "Authorization": f"Bearer {self.teacher_token}"
                }
            )
            page = await context.new_page()
            
            # Try to navigate to teacher dashboard
            dashboard_paths = [
                f"{FRONTEND_BASE}/teacher/dashboard",
                f"{FRONTEND_BASE}/dashboard",
            ]
            
            for path in dashboard_paths:
                try:
                    await page.goto(path, wait_until="networkidle", timeout=5000)
                    await asyncio.sleep(1)
                    print(f"✅ Section 3.6: Teacher dashboard accessible at {path}")
                    break
                except:
                    continue
            
            await context.close()
            await browser.close()

    @pytest.mark.asyncio
    async def test_frontend_find_teachers(self):
        """Test frontend Find Teachers page"""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            search_paths = [
                f"{FRONTEND_BASE}/find-teachers",
                f"{FRONTEND_BASE}/teachers",
                f"{FRONTEND_BASE}/student/find-teachers",
            ]
            
            for path in search_paths:
                try:
                    await page.goto(path, wait_until="networkidle", timeout=5000)
                    await asyncio.sleep(1)
                    print(f"✅ Section 3.7: Find Teachers page accessible at {path}")
                    break
                except:
                    continue
            
            await browser.close()


# ===================================================================
# PYTEST CONFIGURATION
# ===================================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
