# Carepath AI - Hostinger Deployment Guide (UI-Based)

This guide walks you through deploying Carepath AI on Hostinger using their web panel (hPanel) as much as possible, with minimal command-line usage.

---

## Prerequisites

| Item | Details |
|------|---------|
| Hostinger Plan | **VPS Hosting** (KVM 2 or higher recommended, minimum 2GB RAM) |
| Domain | carepath.in (or your custom domain) |
| OpenAI API Key | Get from https://platform.openai.com/api-keys |

> **Important**: Shared hosting will NOT work. You need a VPS plan because Carepath AI requires Node.js and PostgreSQL.

---

## Part 1: Purchase and Set Up Hostinger VPS

### Step 1: Buy a VPS Plan
1. Go to https://www.hostinger.in/vps-hosting
2. Choose **KVM 2** plan or higher (2GB RAM minimum)
3. Complete payment and account setup

### Step 2: Set Up Your VPS
1. Log in to **hPanel** at https://hpanel.hostinger.com
2. Go to **VPS** section in the left sidebar
3. Click **Setup** on your new VPS
4. Choose **Ubuntu 22.04 with Webmin/Virtualmin** as the OS template
   - This gives you a **web-based control panel** to manage your server
5. Set a **root password** (save this securely)
6. Note your **VPS IP address** shown on the dashboard

### Step 3: Access Webmin Panel
1. Open your browser and go to: `https://YOUR_VPS_IP:10000`
2. Accept the security certificate warning
3. Log in with:
   - Username: `root`
   - Password: the root password you set in Step 2

---

## Part 2: Install Required Software via Webmin

### Step 4: Install Node.js 20
1. In Webmin, go to **Others > Command Shell** (or **Tools > Command Shell**)
2. Run this command:
```
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
```
3. Verify by running:
```
node --version
npm --version
```

### Step 5: Install PostgreSQL
1. In Webmin Command Shell, run:
```
apt install -y postgresql postgresql-contrib
```
2. Then set up your database:
```
sudo -u postgres psql -c "CREATE USER carepath WITH PASSWORD 'Choose_A_Strong_Password_Here';"
sudo -u postgres psql -c "CREATE DATABASE carepath_db OWNER carepath;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE carepath_db TO carepath;"
```
> **Save these credentials** - you'll need them in Step 9.

### Step 6: Install PM2 and Nginx
1. In Webmin Command Shell, run:
```
npm install -g pm2
apt install -y nginx certbot python3-certbot-nginx
```

---

## Part 3: Point Your Domain

### Step 7: Configure DNS for carepath.in
1. Log in to your **domain registrar** (where you bought carepath.in)
2. Go to **DNS Management**
3. Add/update these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_VPS_IP | 3600 |
| A | www | YOUR_VPS_IP | 3600 |

4. Wait 5-30 minutes for DNS to propagate
5. You can check at https://dnschecker.org/#A/carepath.in

---

## Part 4: Upload Your Code

### Step 8: Upload Files Using Webmin File Manager

**Option A: Using Webmin File Manager (UI-Based)**
1. In Webmin, go to **Others > File Manager**
2. Navigate to `/var/www/`
3. Create a new folder called `carepath`
4. Upload your project files into `/var/www/carepath/`
   - You can upload a .zip file and extract it in the File Manager

**Option B: Using SFTP with FileZilla (Easier for Large Projects)**
1. Download FileZilla from https://filezilla-project.org
2. Open FileZilla and connect:
   - Host: `sftp://YOUR_VPS_IP`
   - Username: `root`
   - Password: your root password
   - Port: `22`
3. On the left side (your computer), navigate to your Carepath project folder
4. On the right side (server), navigate to `/var/www/carepath/`
5. Select all project files and drag them to the right side
6. Wait for upload to complete

### How to Download Your Code from Replit
1. In Replit, click the three dots menu (top left)
2. Click **Download as zip**
3. Extract the zip file on your computer
4. Upload to Hostinger using Option A or B above

---

## Part 5: Configure and Start the App

### Step 9: Create Environment File
1. In Webmin, go to **Others > File Manager**
2. Navigate to `/var/www/carepath/`
3. Create a new file called `.env`
4. Add these contents:
```
DATABASE_URL=postgresql://carepath:Choose_A_Strong_Password_Here@localhost:5432/carepath_db
NODE_ENV=production
PORT=5000
OPENAI_API_KEY=sk-your-openai-api-key-here
```
> Replace `Choose_A_Strong_Password_Here` with the password from Step 5
> Replace `sk-your-openai-api-key-here` with your actual OpenAI API key

### Step 10: Install Dependencies and Build
1. In Webmin Command Shell, run these commands one by one:
```
cd /var/www/carepath
npm install
npm run build
npm run db:push
```

### Step 11: Start the Application
1. In Webmin Command Shell, run:
```
cd /var/www/carepath
pm2 start npm --name "carepath" -- start
pm2 save
pm2 startup
```
2. Verify it's running:
```
pm2 status
```
You should see `carepath` with status `online`.

---

## Part 6: Configure Nginx and SSL

### Step 12: Set Up Nginx Reverse Proxy
1. In Webmin, go to **Others > File Manager**
2. Navigate to `/etc/nginx/sites-available/`
3. Create a new file called `carepath` with this content:
```nginx
server {
    listen 80;
    server_name carepath.in www.carepath.in;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
4. In Webmin Command Shell, run:
```
ln -s /etc/nginx/sites-available/carepath /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### Step 13: Enable HTTPS (SSL Certificate)
1. In Webmin Command Shell, run:
```
certbot --nginx -d carepath.in -d www.carepath.in
```
2. Enter your email when asked
3. Agree to terms of service
4. Choose to redirect HTTP to HTTPS (option 2)

SSL will auto-renew every 90 days.

---

## Part 7: Verify Everything Works

### Step 14: Test Your Deployment
1. Open https://carepath.in in your browser
2. You should see the Carepath AI login page
3. Log in with admin credentials: `admin@carepath.ai` / `admin123`
4. Test doctor registration and login
5. Test audio recording and AI features

---

## Ongoing Maintenance

### How to Update the App After Code Changes
1. Upload new files via FileZilla or Webmin File Manager
2. In Webmin Command Shell, run:
```
cd /var/www/carepath
npm install
npm run build
pm2 restart carepath
```

### How to View App Logs
In Webmin Command Shell:
```
pm2 logs carepath
```
Or view log files in Webmin File Manager at:
- `/root/.pm2/logs/carepath-out.log` (normal logs)
- `/root/.pm2/logs/carepath-error.log` (error logs)

### How to Restart the App
In Webmin Command Shell:
```
pm2 restart carepath
```

### How to Check Database
In Webmin Command Shell:
```
sudo -u postgres psql carepath_db
```
Then you can run SQL queries like:
```sql
SELECT name, email, role, status FROM users;
```
Type `\q` to exit.

### Automatic Backups
1. In hPanel, go to **VPS > Snapshots**
2. Create regular snapshots of your server
3. This backs up everything - code, database, and configuration

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Site not loading | Check PM2 status: `pm2 status`. If offline, run: `pm2 restart carepath` |
| Database connection error | Verify DATABASE_URL in .env file matches your PostgreSQL credentials |
| SSL certificate expired | Run: `certbot renew` |
| 502 Bad Gateway | App crashed. Check logs: `pm2 logs carepath` then restart: `pm2 restart carepath` |
| Domain not pointing | Verify A record points to VPS IP at https://dnschecker.org |
| Audio/AI not working | Verify OPENAI_API_KEY is correct in .env file |
| Out of memory | Upgrade your VPS plan to more RAM |

---

## Cost Comparison

| Item | Replit | Hostinger VPS |
|------|--------|---------------|
| Hosting | Included in plan | ~$5-13/month (KVM 2-4) |
| SSL | Automatic | Free via Certbot |
| Database | Included | Self-managed (free on VPS) |
| Domain | .replit.app free | carepath.in (separate purchase) |
| OpenAI API | Your API key | Your API key |
| Auto-restart | Built-in | PM2 (free) |
| Total Monthly | Replit plan cost | ~$5-13/month + OpenAI usage |

---

## Important Notes
- The admin account (admin@carepath.ai / admin123) is created automatically when the server starts
- Development and production databases are separate - doctors must register again on the new server
- Always keep your `.env` file secure and never share it
- Take regular VPS snapshots from hPanel for backups
