/* ================================
   Main JavaScript - Three.js + GSAP
   Sankalp Singh Portfolio
================================ */

document.addEventListener('DOMContentLoaded', () => {
  initLoader();
  initCursor();
  initNavigation();
  initThreeJS();
  initScrollAnimations();
  initContactForm();
  initMobileMenu();
  initFloatingPhone();
});

/* ================================
   Loader
================================ */
function initLoader() {
  const loader = document.getElementById('loader');

  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.style.overflow = 'auto';
      animateHero();
    }, 2000);
  });
}

function animateHero() {
  gsap.to('.name-line', {
    opacity: 1,
    y: 0,
    duration: 1,
    stagger: 0.2,
    ease: 'power3.out'
  });

  gsap.to('.floating-badge', {
    opacity: 1,
    duration: 0.8,
    stagger: 0.15,
    delay: 0.5,
    ease: 'power2.out'
  });
}

/* ================================
   Floating Phone Animation
================================ */
function initFloatingPhone() {
  const floatingPhone = document.querySelector('.floating-phone');
  if (floatingPhone) {
    gsap.to(floatingPhone, {
      y: -20,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut'
    });
  }
}

/* ================================
   Custom Cursor (Desktop Only)
================================ */
function initCursor() {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    const cursor = document.querySelector('.custom-cursor');
    const follower = document.querySelector('.cursor-follower');
    if (cursor) cursor.style.display = 'none';
    if (follower) follower.style.display = 'none';
    return;
  }

  const cursor = document.querySelector('.custom-cursor');
  const follower = document.querySelector('.cursor-follower');

  if (!cursor || !follower) return;

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  let followerX = 0, followerY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.2;
    cursorY += (mouseY - cursorY) * 0.2;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';

    followerX += (mouseX - followerX) * 0.1;
    followerY += (mouseY - followerY) * 0.1;
    follower.style.left = followerX + 'px';
    follower.style.top = followerY + 'px';

    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  const hoverElements = document.querySelectorAll('a, button, .skill-card, .project-card');
  hoverElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'scale(2)';
      follower.style.transform = 'scale(1.5)';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'scale(1)';
      follower.style.transform = 'scale(1)';
    });
  });
}

/* ================================
   Navigation
================================ */
function initNavigation() {
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    const scrollProgress = document.querySelector('.scroll-progress-bar');
    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    if (scrollProgress) scrollProgress.style.width = scrollPercent + '%';

    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 200;
      if (window.scrollY >= sectionTop) current = section.getAttribute('id');
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) link.classList.add('active');
    });
  });

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetSection = document.querySelector(targetId);

      gsap.to(window, {
        duration: 1,
        scrollTo: { y: targetSection, offsetY: 0 },
        ease: 'power3.inOut'
      });
    });
  });
}

/* ================================
   Mobile Menu
================================ */
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  if (!menuBtn || !mobileMenu) return;

  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : 'auto';
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetSection = document.querySelector(targetId);

      menuBtn.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = 'auto';

      gsap.to(window, {
        duration: 1,
        scrollTo: { y: targetSection, offsetY: 0 },
        ease: 'power3.inOut'
      });
    });
  });
}

/* ================================
   Three.js Setup
================================ */
let scene, camera, renderer, model, mixer;
let clock = new THREE.Clock();
let canvasContainer;

// Keep model always in camera view
let MODEL_BOUNDS = { halfX: 1, halfY: 1, halfZ: 1 };
let MODEL_TRIGGERS = [];

function lerp(a, b, t) { return a + (b - a) * t; }

function computeModelBounds() {
  if (!model) return;
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  MODEL_BOUNDS = {
    halfX: size.x / 2,
    halfY: size.y / 2,
    halfZ: size.z / 2
  };
}

// How far left/right we can move at a given Z so it still stays visible
function getMaxVisibleX(atZ = 0) {
  if (!camera) return 2;

  const dist = Math.abs(camera.position.z - atZ);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
  const visibleWidth = visibleHeight * camera.aspect;

  const margin = 0.25; // padding from edges
  const maxX = (visibleWidth / 2) - MODEL_BOUNDS.halfX - margin;

  return Math.max(0.6, maxX);
}

function clampX(x, atZ = 0) {
  const maxX = getMaxVisibleX(atZ);
  return THREE.MathUtils.clamp(x, -maxX, maxX);
}

function killModelTriggers() {
  MODEL_TRIGGERS.forEach(t => t.kill());
  MODEL_TRIGGERS = [];
}

function initThreeJS() {
  // Don't initialize on mobile/tablet
  if (window.innerWidth < 1024) {
    const container = document.getElementById('canvas-container');
    if (container) container.style.display = 'none';
    return;
  }

  canvasContainer = document.getElementById('canvas-container');
  if (!canvasContainer) return;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  canvasContainer.appendChild(renderer.domElement);

  // Clean white lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
  mainLight.position.set(5, 5, 5);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-5, 3, 5);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
  backLight.position.set(0, 5, -5);
  scene.add(backLight);

  loadModel();

  window.addEventListener('resize', onWindowResize);
  animate();
}

function loadModel() {
  if (typeof THREE.GLTFLoader === 'undefined') {
    console.warn('⚠️ GLTFLoader not found. Using placeholder.');
    createPlaceholderModel();
    return;
  }

  const loader = new THREE.GLTFLoader();

  // IMPORTANT: Put your model where your server ACTUALLY serves it.
  // Since your /models/... path works, keep macbook.glb inside /models/
  const urlsToTry = [
    '/models/macbook.glb',           // ✅ recommended
    '/assets/models/macbook.glb',    // your old path
    'models/macbook.glb',
    'assets/models/macbook.glb'
  ];

  const tryLoad = (i) => {
    if (i >= urlsToTry.length) {
      console.error('❌ Could not load model from any path:', urlsToTry);
      createPlaceholderModel();
      return;
    }

    const url = urlsToTry[i];
    console.log('🧩 Trying model URL:', url);

    loader.load(
      url,
      (gltf) => {
        model = gltf.scene;

        // Auto-scale the model
        const preBox = new THREE.Box3().setFromObject(model);
        const size = preBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 3.0;
        const scale = targetSize / maxDim;

        model.scale.set(scale, scale, scale);

        // Recompute box after scale for accurate centering
        model.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());

        // Center model
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        scene.add(model);

        // Bounds AFTER scaling/centering
        computeModelBounds();

        // HERO pose: front-facing, slight tilt, left side but clamped
        const heroX = -getMaxVisibleX(model.position.z) * 0.80;
        model.position.x = clampX(heroX, model.position.z);
        model.position.y -= 0.15;

        model.rotation.y = 0.20; // front-ish
        model.rotation.x = 0.10; // slight tilt

        console.log('✅ Model loaded from:', url);

        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach(clip => mixer.clipAction(clip).play());
        }

        setupScrollAnimations();
      },
      (xhr) => {
        if (xhr.total) {
          console.log('Loading: ' + (xhr.loaded / xhr.total * 100).toFixed(1) + '%');
        } else {
          console.log('Loading...');
        }
      },
      (error) => {
        console.warn('⚠️ Failed to load from:', url, error);
        tryLoad(i + 1);
      }
    );
  };

  tryLoad(0);
}

function createPlaceholderModel() {
  const group = new THREE.Group();

  const screenGeometry = new THREE.BoxGeometry(2.4, 1.6, 0.04);
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.1
  });
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.y = 0.85;
  screen.position.z = -0.6;
  screen.rotation.x = -0.12;

  const displayGeometry = new THREE.PlaneGeometry(2.2, 1.4);
  const displayMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const display = new THREE.Mesh(displayGeometry, displayMaterial);
  display.position.z = 0.025;
  screen.add(display);

  for (let i = 0; i < 8; i++) {
    const lineGeometry = new THREE.PlaneGeometry(1.5 - Math.random() * 0.5, 0.05);
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.6
    });
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.position.z = 0.03;
    line.position.y = 0.5 - i * 0.15;
    line.position.x = -0.2 + Math.random() * 0.2;
    screen.add(line);
  }

  const baseGeometry = new THREE.BoxGeometry(2.7, 0.06, 1.9);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.95,
    roughness: 0.05
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);

  const trackpadGeometry = new THREE.PlaneGeometry(1.0, 0.7);
  const trackpadMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.3,
    roughness: 0.6
  });
  const trackpad = new THREE.Mesh(trackpadGeometry, trackpadMaterial);
  trackpad.rotation.x = -Math.PI / 2;
  trackpad.position.y = 0.04;
  trackpad.position.z = 0.4;
  base.add(trackpad);

  group.add(screen);
  group.add(base);

  model = group;
  scene.add(model);

  computeModelBounds();

  const heroX = -getMaxVisibleX(0) * 0.80;
  model.position.set(clampX(heroX, 0), -0.15, 0);
  model.rotation.y = 0.20;
  model.rotation.x = 0.10;

  console.log('✅ Placeholder model created');

  setupScrollAnimations();
}

/**
 * REQUESTED BEHAVIOR:
 * - HERO: show front, slight tilt (left)
 * - ABOUT: move to right, show back (photo side)
 * - NEVER out of view left/right (clamped)
 * - BELOW ABOUT: spin + hide and stay hidden (skills+)
 */
function setupScrollAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  if (!model || !canvasContainer) return;

  killModelTriggers();
  computeModelBounds();

  // Base poses
  const heroPose = {
    rotY: 0.20,
    rotX: 0.10,
    y: -0.15,
    z: 0
  };

  const aboutPose = {
    rotY: heroPose.rotY + Math.PI, // show back
    rotX: 0.06,
    y: -0.10,
    z: 0
  };

  function heroX() { return -getMaxVisibleX(model.position.z) * 0.80; }
  function aboutX() { return  getMaxVisibleX(model.position.z) * 0.80; }

  gsap.set(canvasContainer, { opacity: 1 });

  // 1) HERO: stay left, front visible
  MODEL_TRIGGERS.push(
    ScrollTrigger.create({
      id: "3d-hero",
      trigger: "#hero",
      start: "top top",
      end: "bottom top",
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;

        const x = heroX();
        model.position.x = clampX(x, model.position.z);
        model.position.y = heroPose.y - p * 0.18;

        model.rotation.y = heroPose.rotY + p * 0.08;
        model.rotation.x = heroPose.rotX + p * 0.02;

        canvasContainer.style.opacity = "1";
      }
    })
  );

  // 2) ABOUT: move to right + rotate to back
  MODEL_TRIGGERS.push(
    ScrollTrigger.create({
      id: "3d-about",
      trigger: "#about",
      start: "top 85%",
      end: "bottom 35%",
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;

        const x = lerp(heroX(), aboutX(), p);
        model.position.x = clampX(x, model.position.z);

        model.position.y = lerp(heroPose.y - 0.18, aboutPose.y, p);

        model.rotation.y = lerp(heroPose.rotY + 0.08, aboutPose.rotY, p);
        model.rotation.x = lerp(heroPose.rotX + 0.02, aboutPose.rotX, p);

        canvasContainer.style.opacity = "1";
      }
    })
  );

  // 3) BELOW ABOUT: spin + hide (skills and below)
  MODEL_TRIGGERS.push(
    ScrollTrigger.create({
      id: "3d-hide-below-about",
      trigger: "#skills",
      start: "top 95%",
      invalidateOnRefresh: true,
      onEnter: () => {
        if (!model) return;
        gsap.to(model.rotation, {
          y: model.rotation.y + Math.PI * 1.25,
          duration: 0.85,
          ease: "power2.inOut"
        });
        gsap.to(canvasContainer, {
          opacity: 0,
          duration: 0.35,
          ease: "power2.out"
        });
      },
      onLeaveBack: () => {
        gsap.to(canvasContainer, {
          opacity: 1,
          duration: 0.25,
          ease: "power2.out"
        });
      }
    })
  );
}

function onWindowResize() {
  if (!camera || !renderer) return;

  if (window.innerWidth < 1024) {
    if (canvasContainer) canvasContainer.style.display = 'none';
    return;
  } else {
    if (canvasContainer) canvasContainer.style.display = 'block';
  }

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  computeModelBounds();
  if (model) model.position.x = clampX(model.position.x, model.position.z);
}

let lastFloat = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  // NO DRIFT floating
  if (model) {
    const f = Math.sin(Date.now() * 0.0008) * 0.02;
    model.position.y += (f - lastFloat);
    lastFloat = f;
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}

/* ================================
   Scroll Animations (GSAP)
================================ */
function initScrollAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  // Section headers
  gsap.utils.toArray('.section-header').forEach(header => {
    gsap.from(header, {
      scrollTrigger: {
        trigger: header,
        start: 'top 80%',
        toggleActions: 'play none none reverse'
      },
      opacity: 0,
      y: 50,
      duration: 0.8,
      ease: 'power3.out'
    });
  });

  // About text
  gsap.from('.about-intro', {
    scrollTrigger: { trigger: '.about-intro', start: 'top 80%' },
    opacity: 0, y: 30, duration: 0.8
  });

  gsap.from('.about-body', {
    scrollTrigger: { trigger: '.about-body', start: 'top 80%' },
    opacity: 0, y: 30, duration: 0.8, stagger: 0.2
  });

  // Stats counter
  gsap.utils.toArray('.stat-number').forEach(stat => {
    const target = parseInt(stat.dataset.count);
    gsap.from(stat, {
      scrollTrigger: { trigger: stat, start: 'top 85%' },
      textContent: 0,
      duration: 2,
      ease: 'power1.out',
      snap: { textContent: 1 },
      onUpdate: function () {
        stat.textContent = Math.round(this.targets()[0].textContent);
      }
    });
  });

  // Skills
  gsap.utils.toArray('.skills-category').forEach((cat, i) => {
    gsap.from(cat, {
      scrollTrigger: { trigger: cat, start: 'top 85%' },
      opacity: 0, y: 50, duration: 0.8, delay: i * 0.15
    });
  });

  gsap.utils.toArray('.skill-card').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: { trigger: card, start: 'top 90%' },
      opacity: 0, y: 30, scale: 0.9, duration: 0.5, delay: (i % 8) * 0.05
    });
  });

  // Projects
  gsap.from('.project-card', {
    scrollTrigger: { trigger: '.project-card', start: 'top 80%' },
    opacity: 0, y: 80, duration: 1, ease: 'power3.out'
  });

  // Contact
  gsap.from('.contact-info', {
    scrollTrigger: { trigger: '.contact-info', start: 'top 80%' },
    opacity: 0, x: -50, duration: 0.8
  });

  gsap.from('.contact-form-container', {
    scrollTrigger: { trigger: '.contact-form-container', start: 'top 80%' },
    opacity: 0, x: 50, duration: 0.8
  });

  gsap.utils.toArray('.contact-method').forEach((method, i) => {
    gsap.from(method, {
      scrollTrigger: { trigger: method, start: 'top 90%' },
      opacity: 0, x: -30, duration: 0.5, delay: i * 0.1
    });
  });
}

/* ================================
   Contact Form
================================ */
function initContactForm() {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Sending...</span>';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        status.textContent = 'Message sent!';
        status.className = 'form-status success';
        status.style.display = 'block';
        form.reset();
      } else {
        throw new Error('Failed');
      }
    } catch (error) {
      status.textContent = 'Thank you! (Demo mode)';
      status.className = 'form-status success';
      status.style.display = 'block';
      form.reset();
    }

    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    setTimeout(() => { status.style.display = 'none'; }, 5000);
  });
}

/* ================================
   Chatbot Functions
================================ */
window.openChatbot = function () {
  document.getElementById('chatbot-container')?.classList.add('active');
  document.getElementById('chatbot-toggle')?.classList.add('hidden');
};

window.closeChatbot = function () {
  document.getElementById('chatbot-container')?.classList.remove('active');
  document.getElementById('chatbot-toggle')?.classList.remove('hidden');
};

window.toggleChatbot = function () {
  const container = document.getElementById('chatbot-container');
  if (!container) return;
  container.classList.contains('active') ? closeChatbot() : openChatbot();
};
