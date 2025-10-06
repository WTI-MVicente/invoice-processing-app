@echo off
echo ==============================================
echo    Invoice Processing App - Server Restart
echo ==============================================
echo.

REM Kill existing Node.js processes
echo 🛑 Stopping existing servers...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

REM Start Backend Server
echo 🚀 Starting Backend Server (Port 5001)...
cd /d "%~dp0backend"
start "Backend Server" cmd /c "npm run dev"

REM Wait a moment for backend to start
timeout /t 3 >nul

REM Start Frontend Server  
echo 🌐 Starting Frontend Server (Port 3000)...
cd /d "%~dp0frontend"
start "Frontend Server" cmd /c "npm start"

echo.
echo ✅ Both servers are starting...
echo.
echo 📋 Access URLs:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:5001
echo    Health:   http://localhost:5001/api/health
echo.
echo 🔐 Login Credentials:
echo    Email:    demo@waterfield.tech
echo    Password: waterfield2025
echo.
echo Press any key to close this window...
pause >nul