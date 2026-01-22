/* ================================
   AI Chatbot - OpenAI (ChatGPT) API Integration
   Sankalp Singh Portfolio
================================ */

// Configuration - These will be set from environment variables on the server
const CHATBOT_CONFIG = {
    apiEndpoint: '/api/chat', // server calls OpenAI; no API keys in the browser
    schedulingEndpoint: '/api/schedule-meeting',
    
    // Sankalp's professional information for the AI
    ownerInfo: {
        name: 'Sankalp Singh',
        title: 'Full Stack Developer',
        phone: '682-219-8682',
        location: 'Dallas, Texas',
        
        // Experience & Background
        experience: `
            I'm a Full Stack Developer with expertise in building complete digital solutions from the ground up.
            My work spans mobile applications (iOS & Android), web platforms, and custom business systems.
            I specialize in React, React Native, Node.js, Firebase, and modern JavaScript frameworks.
            I also work with 3D modeling in Blender, creating immersive visual experiences.
            
            Notable projects include Radio Sangam - a comprehensive mobile app for Dallas's radio station
            featuring a points-based rewards system, live streaming, and a custom CRM dashboard.
        `,
        
        // Skills breakdown
        skills: {
            frontend: ['React', 'React Native', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Three.js', 'HTML5/CSS3'],
            backend: ['Node.js', 'Express.js', 'Firebase', 'MongoDB', 'PostgreSQL', 'REST APIs', 'GraphQL'],
            tools: ['Git', 'Docker', 'AWS', 'Blender', 'Figma', 'Stripe', 'Mailgun']
        },
        
        // Availability - Update this based on your schedule
        availability: {
            timezone: 'CST (Central Standard Time)',
            workingHours: '9:00 AM - 6:00 PM CST',
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            preferredMeetingTimes: ['10:00 AM', '2:00 PM', '4:00 PM'],
            responseTime: 'Within 24 hours'
        },
        
        // Rates - Update with your actual rates
        rates: {
            hourly: 'Starting at $75/hour',
            projectBased: 'Project quotes available upon request',
            consultation: 'Free 30-minute initial consultation',
            retainer: 'Monthly retainer packages available'
        },
        
        // Services offered
        services: [
            'Custom Web Application Development',
            'Mobile App Development (iOS & Android)',
            'Full Stack Development',
            'API Development & Integration',
            'Database Design & Management',
            'CRM & Dashboard Development',
            '3D Modeling & Visualization',
            'Technical Consultation'
        ]
    },
};

// Chatbot state
let conversationHistory = [];
let lastBotMessage = '';
let isCollectingMeetingInfo = false;
let meetingData = {
    name: '',
    email: '',
    preferredDateTime: '',
    projectDescription: ''
};

// Initialize chatbot
document.addEventListener('DOMContentLoaded', () => {
    initChatbot();
});

function initChatbot() {
    const inputField = document.getElementById('chatbot-input-field');
    const sendBtn = document.getElementById('chatbot-send');
    const quickActions = document.querySelectorAll('.quick-action');
    
    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);
    
    // Send message on Enter key
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Quick action buttons
    quickActions.forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.dataset.message;
            inputField.value = message;
            sendMessage();
        });
    });
}


function normalizeText(s) {
    return (s || '').toLowerCase().trim();
}

function userWantsMeeting(message) {
    const m = normalizeText(message);
    const last = normalizeText(lastBotMessage);

    // Explicit ask
    const triggers = ['schedule', 'meeting', 'book', 'call', 'consultation', 'availability', 'available'];
    if (triggers.some(t => m.includes(t))) return true;

    // User says "yes" after bot asked about booking/scheduling
    const affirm = ['yes', 'yeah', 'yep', 'sure', 'please', 'ok', 'okay', "let's do it", 'lets do it'];
    const botAsked = last.includes('book a call') || last.includes('schedule') || last.includes('meeting') || last.includes('consultation');
    if (botAsked && affirm.includes(m)) return true;

    return false;
}

function userCancelsMeeting(message) {
    const m = normalizeText(message);
    return ['cancel', 'stop', 'nevermind', 'never mind', 'forget it', 'no'].includes(m);
}


async function sendMessage() {
    const inputField = document.getElementById('chatbot-input-field');
    const message = inputField.value.trim();

    if (!message) return;

    // Clear input
    inputField.value = '';

    // Add user message to chat
    addMessage(message, 'user');

    // If user wants to schedule a meeting, switch to the structured flow (no AI call needed)
    if (!isCollectingMeetingInfo && userWantsMeeting(message)) {
        startMeetingCollection();
        addMessage(`I'd be happy to help you schedule a meeting with Sankalp!\n\nSankalp is available **Monday through Friday, 9 AM - 6 PM CST**.\n\n**First, what is your name?**`, 'bot');
        return;
    }

    // If we're collecting meeting info, handle it without sending to AI
    if (isCollectingMeetingInfo) {
        await handleMeetingCollection(message);
        return;
    }

    // Add to conversation history (AI context)
    conversationHistory.push({
        role: 'user',
        content: message
    });

    // Show typing indicator
    showTypingIndicator();

    try {
        // Send to AI API
        const response = await sendToAI(message);

        // Remove typing indicator
        hideTypingIndicator();

        // Add bot response
        addMessage(response, 'bot');
    } catch (error) {
        hideTypingIndicator();
        addMessage('I apologize, but I\'m having trouble connecting right now. Please try again or contact Sankalp directly at 682-219-8682.', 'bot');
    }
}


async function sendToAI(message) {
    try {
        const response = await fetch(CHATBOT_CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                // send only the most recent messages to control token usage
                history: conversationHistory.slice(-20)
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        
        // Add assistant response to history
        conversationHistory.push({
            role: 'assistant',
            content: data.response
        });
        
        return data.response;
    } catch (error) {
        console.error('AI API Error:', error);
        
        // Fallback responses for demo/offline mode
        return getFallbackResponse(message);
    }
}

function getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Experience questions
    if (lowerMessage.includes('experience') || lowerMessage.includes('background') || lowerMessage.includes('about')) {
        return `Sankalp Singh is a Full Stack Developer with extensive experience in building complete digital solutions. His expertise spans:

• **Mobile Development**: iOS and Android apps using React Native
• **Web Development**: React, Next.js, and modern JavaScript frameworks
• **Backend Systems**: Node.js, Express, Firebase, and database management
• **3D Development**: Blender modeling and Three.js visualizations

A notable project is Radio Sangam - a comprehensive mobile app for a Dallas radio station featuring live streaming, a points-based rewards system, and a custom CRM dashboard. Would you like to know more about any specific area?`;
    }
    
    // Rates questions
    if (lowerMessage.includes('rate') || lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('charge')) {
        return `Here are Sankalp's rates:

• **Hourly Rate**: Starting at $75/hour
• **Project-Based**: Custom quotes based on scope and requirements
• **Consultation**: Free 30-minute initial consultation to discuss your project

For accurate project pricing, I'd recommend scheduling a free consultation where Sankalp can understand your specific needs. Would you like to book a call?`;
    }
    
    // Schedule/meeting questions
    if (lowerMessage.includes('schedule') || lowerMessage.includes('meeting') || lowerMessage.includes('call') || lowerMessage.includes('book') || lowerMessage.includes('available')) {
        startMeetingCollection();
        return `I'd be happy to help you schedule a meeting with Sankalp!

Sankalp is available **Monday through Friday, 9 AM - 6 PM CST**.

To book a meeting, I'll need a few details:

**First, what is your name?**`;
    }
    
    // Skills questions
    if (lowerMessage.includes('skill') || lowerMessage.includes('technology') || lowerMessage.includes('tech stack') || lowerMessage.includes('what can')) {
        return `Sankalp's technical expertise includes:

**Frontend Development**
React, React Native, Next.js, TypeScript, Tailwind CSS, Three.js, HTML5/CSS3

**Backend Development**
Node.js, Express.js, Firebase, MongoDB, PostgreSQL, REST APIs, GraphQL

**Tools & Platforms**
Git, Docker, AWS, Vercel, Blender (3D), Figma, Stripe, Mailgun

He specializes in building end-to-end solutions from mobile apps to web platforms with custom backend systems. Is there a specific technology you'd like to discuss?`;
    }
    
    // Contact
    if (lowerMessage.includes('contact') || lowerMessage.includes('reach') || lowerMessage.includes('phone') || lowerMessage.includes('email')) {
        return `You can reach Sankalp through:

📱 **Phone**: 682-219-8682
📍 **Location**: Dallas, Texas
⏰ **Response Time**: Within 24 hours

You can also fill out the contact form on this page, or I can help you schedule a call. What would you prefer?`;
    }
    
    // Services
    if (lowerMessage.includes('service') || lowerMessage.includes('offer') || lowerMessage.includes('do you do') || lowerMessage.includes('help with')) {
        return `Sankalp offers comprehensive development services:

• **Custom Web Application Development**
• **Mobile App Development** (iOS & Android)
• **Full Stack Development**
• **API Development & Integration**
• **Database Design & Management**
• **CRM & Dashboard Development**
• **3D Modeling & Visualization**
• **Technical Consultation**

Each project is tailored to meet specific business needs. Would you like to discuss a particular service or schedule a consultation?`;
    }
    
    // Project inquiry
    if (lowerMessage.includes('project') || lowerMessage.includes('work') || lowerMessage.includes('portfolio')) {
        return `One of Sankalp's notable projects is **Radio Sangam** - a comprehensive solution for a Dallas-based radio station:

📱 **Mobile App** (iOS & Android)
• Points-based rewards system for listeners
• Live podcast streaming
• Redeemable rewards for event tickets & local deals

📊 **Custom CRM Dashboard**
• Complete content management
• Partner management
• User analytics

The entire project, from mobile app to backend infrastructure, was built entirely by Sankalp. Would you like to discuss how a similar solution could work for your needs?`;
    }
    
    // Default response
    return `Thank you for your message! I'm Sankalp's AI assistant, and I'm here to help with:

• Information about Sankalp's experience and skills
• Project inquiries and services
• Rates and availability
• Scheduling meetings

How can I assist you today?`;
}

function startMeetingCollection() {
    isCollectingMeetingInfo = true;
    meetingData = {
        name: '',
        email: '',
        preferredDateTime: '',
        projectDescription: ''
    };
}

async function handleMeetingCollection(message) {
    // Allow user to cancel the meeting flow
    if (userCancelsMeeting(message)) {
        isCollectingMeetingInfo = false;
        meetingData = { name: '', email: '', preferredDateTime: '', projectDescription: '' };
        addMessage('No problem — we can continue chatting. How can I help you?', 'bot');
        return;
    }

    hideTypingIndicator();
    
    if (!meetingData.name) {
        meetingData.name = message;
        addMessage(`Nice to meet you, ${meetingData.name}! **What is your email address?**`, 'bot');
    } else if (!meetingData.email) {
        // Validate email
        if (validateEmail(message)) {
            meetingData.email = message;
            addMessage(`Great! **When would you like to meet?**\n\nSankalp is available Monday-Friday, 9 AM - 6 PM CST.\nPreferred times: 10:00 AM, 2:00 PM, or 4:00 PM\n\nPlease provide your preferred date and time.`, 'bot');
        } else {
            addMessage(`That doesn't appear to be a valid email address. Could you please provide a valid email?`, 'bot');
        }
    } else if (!meetingData.preferredDateTime) {
        meetingData.preferredDateTime = message;
        addMessage(`Perfect! **Finally, please briefly describe your project or what you'd like to discuss.**`, 'bot');
    } else if (!meetingData.projectDescription) {
        meetingData.projectDescription = message;
        
        // Complete - submit meeting request
        await submitMeetingRequest();
    }
}

async function submitMeetingRequest() {
    addMessage(`Thank you! Here's a summary of your meeting request:

📋 **Meeting Details**
• **Name**: ${meetingData.name}
• **Email**: ${meetingData.email}
• **Preferred Time**: ${meetingData.preferredDateTime}
• **Project**: ${meetingData.projectDescription}

I'm sending this to Sankalp now. He will confirm your meeting within 24 hours via email.

Is there anything else I can help you with?`, 'bot');
    
    // Reset meeting collection state
    isCollectingMeetingInfo = false;
    
    // Send meeting request to backend
    try {
        const response = await fetch(CHATBOT_CONFIG.schedulingEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(meetingData)
        });
        
        if (!response.ok) {
            console.error('Failed to submit meeting request to server');
        }
    } catch (error) {
        console.error('Meeting submission error:', error);
        // Meeting info is already displayed to user, so no need for error message
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function addMessage(content, type) {
    if (type === 'bot') lastBotMessage = content;
    const messagesContainer = document.getElementById('chatbot-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Convert markdown-style formatting to HTML
    let formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/• /g, '&bull; ');
    
    contentDiv.innerHTML = `<p>${formattedContent}</p>`;
    messageDiv.appendChild(contentDiv);
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot typing-indicator';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Add typing indicator styles dynamically
const typingStyles = document.createElement('style');
typingStyles.textContent = `
    .typing-dots {
        display: flex;
        gap: 4px;
        padding: 5px 0;
    }
    
    .typing-dots span {
        width: 8px;
        height: 8px;
        background: var(--primary);
        border-radius: 50%;
        animation: typingBounce 1.4s ease-in-out infinite;
    }
    
    .typing-dots span:nth-child(1) { animation-delay: 0s; }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes typingBounce {
        0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
        }
        30% {
            transform: translateY(-10px);
            opacity: 1;
        }
    }
`;
document.head.appendChild(typingStyles);