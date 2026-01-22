# Sankalp Singh - Full Stack Developer Portfolio

A stunning, interactive portfolio website featuring Three.js 3D animations, GSAP scroll-driven effects, an AI-powered chatbot using Claude API, and Mailgun email integration.

![Portfolio Preview](./public/assets/images/preview.png)

---

## 🌟 Features

- **Immersive 3D Experience**: Three.js-powered MacBook model with scroll-driven animations
- **Cinematic Scroll Effects**: GSAP ScrollTrigger for smooth, Apple-style section transitions
- **AI Chatbot**: Claude-powered assistant that answers questions about your experience, rates, and availability
- **Meeting Scheduler**: Chatbot can schedule meetings and send email notifications
- **Contact Form**: Mailgun integration for contact form submissions
- **Responsive Design**: Fully mobile-optimized with custom animations
- **Custom Cursor**: Interactive cursor effects for desktop users
- **Loading Animation**: Animated loader with name reveal

---

## 📁 Project Structure

```
sankalp-portfolio/
├── public/
│   ├── index.html              # Main HTML file
│   ├── assets/
│   │   └── images/             # Project images & screenshots
│   └── models/
│       └── macbook.gltf        # Your 3D MacBook model (add here)
├── src/
│   ├── css/
│   │   └── styles.css          # All styles
│   └── js/
│       ├── main.js             # Three.js, GSAP, and main interactions
│       └── chatbot.js          # AI Chatbot logic
├── server/
│   └── index.js                # Express server with API routes
├── .env.example                # Environment variables template
├── .env                        # Your environment variables (create this)
├── package.json                # Dependencies
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Anthropic API key (for Claude chatbot)
- Mailgun account and API key (for emails)

### Installation

1. **Clone or download this repository**

```bash
cd sankalp-portfolio
```

2. **Install dependencies**

```bash
npm install
```

3. **Create environment file**

```bash
cp .env.example .env
```

4. **Configure your environment variables** (see detailed setup below)

5. **Start the development server**

```bash
npm run dev
```

6. **Open in browser**

```
http://localhost:3000
```

---

## ⚙️ Configuration Guide

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000

# Anthropic (Claude) API
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=your_domain.mailgun.org

# Your Email (where contact form submissions are sent)
OWNER_EMAIL=your_email@example.com
```

---

## 🤖 Setting Up Anthropic (Claude) API

The AI chatbot uses Claude to answer questions about your experience, handle meeting scheduling, and provide a professional conversational experience.

### Step 1: Create an Anthropic Account

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up for an account or log in
3. Navigate to **API Keys** section

### Step 2: Generate an API Key

1. Click **Create Key**
2. Give it a name (e.g., "Portfolio Chatbot")
3. Copy the API key immediately (it won't be shown again)

### Step 3: Add to Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Customize the Chatbot

The chatbot's behavior is controlled by the system prompt in `server/index.js`. You can customize:

- Your skills and experience
- Your rates (currently set to $75/hour starting)
- Your availability (currently Monday-Friday, 9 AM - 6 PM CST)
- Your services offered
- The professional tone and personality

**Location in code:** `server/index.js` → `SYSTEM_PROMPT` constant

---

## 📧 Setting Up Mailgun

Mailgun handles all email functionality including contact form submissions and meeting notifications.

### Step 1: Create a Mailgun Account

1. Go to [mailgun.com](https://www.mailgun.com)
2. Sign up for a free account (includes 5,000 free emails/month)
3. Verify your email address

### Step 2: Add and Verify Your Domain

1. In the Mailgun dashboard, go to **Sending** → **Domains**
2. Click **Add New Domain**
3. Enter your domain (e.g., `mg.yourdomain.com` or `mail.yourdomain.com`)

#### DNS Configuration

Add the following DNS records to your domain registrar:

**For sending emails (required):**

| Type | Name | Value |
|------|------|-------|
| TXT | mg | v=spf1 include:mailgun.org ~all |
| TXT | smtp._domainkey.mg | (provided by Mailgun) |

**For receiving (optional):**

| Type | Priority | Value |
|------|----------|-------|
| MX | 10 | mxa.mailgun.org |
| MX | 10 | mxb.mailgun.org |

5. Wait for DNS propagation (can take up to 48 hours, usually much faster)
6. Click **Verify DNS Settings** in Mailgun dashboard

### Step 3: Get Your API Key

1. Go to **API Security** in the Mailgun dashboard
2. You'll see your **Private API Key**
3. Copy this key

### Step 4: Add to Environment Variables

```env
MAILGUN_API_KEY=your-private-api-key-here
MAILGUN_DOMAIN=mg.yourdomain.com
OWNER_EMAIL=your-email@yourdomain.com
```

### Using the Sandbox Domain (For Testing)

If you don't have a custom domain, you can use Mailgun's sandbox domain for testing:

1. Find your sandbox domain in the dashboard (looks like `sandbox1234567890.mailgun.org`)
2. Add authorized recipients (emails you want to send to during testing)
3. Use the sandbox domain in your `.env` file

**Note:** Sandbox domains can only send to pre-authorized email addresses.

```env
MAILGUN_DOMAIN=sandbox1234567890.mailgun.org
```

---

## 🎨 Adding Your 3D Model

The portfolio is set up to display a MacBook model. Here's how to add your own:

### Step 1: Export from Blender

1. Open your MacBook model in Blender
2. Go to **File** → **Export** → **glTF 2.0 (.glb/.gltf)**
3. In export settings:
   - Format: **glTF Separate (.gltf + .bin + textures)**
   - Include: ✅ Selected Objects, ✅ Custom Properties
   - Transform: ✅ +Y Up
   - Geometry: ✅ Apply Modifiers, ✅ UVs, ✅ Normals
   - Animation: ✅ (if you have animations)
4. Export to `public/models/macbook.gltf`

### Step 2: Verify File Structure

After export, you should have:
```
public/models/
├── macbook.gltf      # Main model file
├── macbook.bin       # Binary geometry data
└── textures/         # Any texture images (if used)
```

### Step 3: Adjust Model Settings (if needed)

If your model needs different positioning or scaling, edit `src/js/main.js`:

```javascript
// In the loadModel() function, adjust these values:
model.scale.set(1, 1, 1);        // Scale: (x, y, z)
model.position.set(2, 0, 0);     // Position: (x, y, z)
model.rotation.y = -0.3;         // Initial rotation
```

---

## 📸 Adding Project Screenshots

### Step 1: Prepare Your Images

Recommended specifications:
- **Format:** PNG or WebP
- **Resolution:** 1200x800px (or 16:10 aspect ratio)
- **File size:** Under 500KB (optimize with tools like TinyPNG)

### Step 2: Add to Images Folder

```
public/assets/images/
├── radio-sangam-1.png
├── radio-sangam-2.png
├── radio-sangam-3.png
└── profile-photo.jpg
```

### Step 3: Update HTML

In `public/index.html`, replace the placeholder divs with actual images:

```html
<!-- Replace this: -->
<div class="project-image-placeholder">
    <span class="placeholder-icon">📱</span>
    <span class="placeholder-text">Project Screenshot</span>
</div>

<!-- With this: -->
<img src="./assets/images/radio-sangam-1.png" alt="Radio Sangam App" class="project-image">
```

For your profile photo in the About section:

```html
<!-- Replace the placeholder with: -->
<img src="./assets/images/profile-photo.jpg" alt="Sankalp Singh" class="profile-image">
```

---

## 🌐 Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy**
```bash
vercel
```

3. **Add Environment Variables**
   - Go to your project settings on Vercel
   - Navigate to **Environment Variables**
   - Add all variables from your `.env` file

### Option 2: Railway

1. Create a new project on [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables in the dashboard
4. Deploy automatically on push

### Option 3: DigitalOcean App Platform

1. Create a new app on DigitalOcean
2. Connect your repository
3. Set the run command to `npm start`
4. Add environment variables
5. Deploy

### Option 4: Traditional VPS (Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your repository
git clone your-repo-url
cd sankalp-portfolio

# Install dependencies
npm install

# Install PM2 for process management
sudo npm install -g pm2

# Start the application
pm2 start server/index.js --name portfolio

# Set up PM2 to start on boot
pm2 startup
pm2 save
```

Configure Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔧 Customization

### Changing Colors

Edit the CSS variables in `src/css/styles.css`:

```css
:root {
    --primary: #99FFCC;           /* Main mint color */
    --primary-dark: #7ad4a8;      /* Darker mint */
    --primary-light: #b8ffe0;     /* Lighter mint */
    --bg-dark: #1e1e1e;           /* Background */
    --bg-darker: #141414;         /* Darker background */
    --bg-card: #252525;           /* Card backgrounds */
}
```

### Updating Personal Information

1. **HTML (`public/index.html`)**
   - Update name, title, contact info
   - Modify project descriptions
   - Update social links in footer

2. **Chatbot (`src/js/chatbot.js`)**
   - Update `CHATBOT_CONFIG.ownerInfo` with your details
   - Modify rates, availability, and services

3. **Server (`server/index.js`)**
   - Update `SYSTEM_PROMPT` with your information
   - Modify `CONFIG` object with your email

### Adding More Projects

Duplicate the project card structure in `public/index.html`:

```html
<div class="project-card">
    <div class="project-media">
        <img src="./assets/images/your-project.png" alt="Project Name">
        <div class="project-overlay">
            <div class="project-links">
                <a href="https://your-project.com" target="_blank" class="project-link">
                    <span>Live Site</span>
                </a>
            </div>
        </div>
    </div>
    <div class="project-info">
        <div class="project-tags">
            <span class="tag">React</span>
            <span class="tag">Node.js</span>
        </div>
        <h3 class="project-title">Project Name</h3>
        <p class="project-description">Project description...</p>
    </div>
</div>
```

---

## 🐛 Troubleshooting

### Chatbot Not Responding

1. Check that `ANTHROPIC_API_KEY` is set correctly in `.env`
2. Verify your API key is valid at console.anthropic.com
3. Check server console for error messages

### Emails Not Sending

1. Verify Mailgun domain is verified (check DNS settings)
2. Confirm `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` are correct
3. For sandbox domains, ensure recipient emails are authorized
4. Check Mailgun dashboard for logs

### 3D Model Not Loading

1. Verify file is at `public/models/macbook.gltf`
2. Check browser console for loading errors
3. Ensure GLTF file is valid (try viewing in online GLTF viewer)
4. Check that all referenced textures/bins are in the same folder

### Animations Stuttering

1. Reduce particle count in `main.js` → `addParticles()`
2. Lower `devicePixelRatio` cap in Three.js setup
3. Disable animations on mobile for better performance

---

## 📱 Mobile Considerations

The site is fully responsive with:
- Hamburger menu for mobile navigation
- Touch-friendly chatbot interface
- Optimized 3D rendering for mobile devices
- Simplified animations on smaller screens

---

## 🔒 Security Notes

1. **Never commit `.env` to version control** - It's already in `.gitignore`
2. **Use environment variables** for all API keys in production
3. **Rate limiting** - Consider adding rate limiting for production
4. **Input validation** - The server validates required fields
5. **CORS** - Configure CORS properly for production

---

## 📄 License

MIT License - Feel free to use this for your own portfolio!

---

## 🤝 Support

If you have questions or need help customizing:
- Open an issue on GitHub
- Contact: 682-219-8682

---

Built with ❤️ by Sankalp Singh
