@echo off
echo ===========================================
echo PostgreSQL Database Setup for Invoice App
echo ===========================================
echo.

REM Set PostgreSQL path (adjust if your version is different)
set PSQL_PATH="C:\Program Files\PostgreSQL\18\bin"
set PGPASSWORD=

echo Please enter your PostgreSQL postgres user password:
set /p PGPASSWORD=

echo.
echo Creating database 'invoice_processing_db'...
%PSQL_PATH%\createdb.exe -U postgres -h localhost -p 5432 invoice_processing_db

if %ERRORLEVEL% EQU 0 (
    echo ✅ Database created successfully!
    echo.
    echo Running database migration...
    cd backend
    node scripts/migrate.js
    
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Database schema applied successfully!
        echo.
        echo Next steps:
        echo 1. Copy backend\.env.example to backend\.env
        echo 2. Update DATABASE_URL in .env file
        echo 3. Add your Claude API key to .env file
        echo 4. Run: npm run dev
    ) else (
        echo ❌ Database migration failed!
        echo Make sure Node.js dependencies are installed: cd backend && npm install
    )
) else (
    echo ❌ Database creation failed!
    echo Please check your PostgreSQL installation and password
)

echo.
pause