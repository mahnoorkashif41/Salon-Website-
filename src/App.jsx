import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Clock3, Instagram, LogOut, MapPin, Mail, Menu, Phone, Sparkles, X } from 'lucide-react'
import { formatPrice, serviceImage, useServices } from './data/services.js'
import { useAuth } from './auth/AuthContext.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import { AdminLoginPage, AuthPage, CustomerDashboard, AdminDashboard } from './auth/AuthPages.jsx'
import BookingPage from './booking/BookingPage.jsx'

const address = 'Main Boulevard, Gulberg III, Lahore, Pakistan'

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const close = () => setOpen(false)
  const accountLinks = user
    ? <><Link to={profile?.role === 'admin'? '/admin/dashboard' : '/dashboard'} className="nav-link" onClick={close}>My space</Link><button className="nav-contact auth-nav-button" onClick={async () => { close(); await signOut() }}>Log out <LogOut size={14} /></button></>
    : <><Link to="/login" className={`nav-link ${location.pathname === '/login'? 'active' : ''}`} onClick={close}>Log in</Link><Link to="/signup" className="nav-contact" onClick={close}>Sign up <ArrowUpRight size={15} /></Link></>
  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="wordmark" onClick={close} aria-label="Élan Beauty Studio home"><span className="wordmark-main">ÉLAN</span><span className="wordmark-sub">BEAUTY STUDIO</span></Link>
      <button className="menu-toggle" aria-label={open? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)}>{open? <X size={21} /> : <Menu size={21} />}</button>
      <nav className={`main-nav ${open? 'is-open' : ''}`} aria-label="Main navigation">
        <NavLink to="/" onClick={close} className={({ isActive }) => `nav-link ${isActive && location.pathname === '/'? 'active' : ''}`}>Home</NavLink>
        <NavLink to="/services" onClick={close} className={({ isActive }) => `nav-link ${isActive? 'active' : ''}`}>Services</NavLink>
        <a href="/#why-us" onClick={close} className="nav-link">Why us</a>
        {accountLinks}
        <Link to="/book" className="nav-contact nav-book-cta mobile-contact" onClick={close}>Book Appointment <ArrowRight size={16} /></Link>
      </nav>
      <Link to="/book" className="nav-contact nav-book-cta desktop-contact">Book Appointment <ArrowRight size={16} /></Link>
    </div>
  </header>
}

function Footer() {
  return <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand">
        <Link to="/" className="wordmark light" aria-label="Élan Beauty Studio home"><span className="wordmark-main">ÉLAN</span><span className="wordmark-sub">BEAUTY STUDIO</span></Link>
        <p>A little time for yourself.<br />A feeling that stays with you.</p>
      </div>
      <nav className="footer-column footer-navigation" aria-label="Footer navigation">
        <span className="eyebrow">EXPLORE</span>
        <Link to="/">Home</Link><Link to="/services">Our services</Link><a href="/#about">Our story</a><a href="/#visit">Find us</a><Link to="/book">Book Appointment</Link>
      </nav>
      <div className="footer-column footer-contact">
        <span className="eyebrow">COME BY</span>
        <p>{address}</p>
        <a href="tel:+924235870000">+92 42 3587 0000</a>
        <a href="mailto:hello@elanbeautystudio.pk">hello@elanbeautystudio.pk</a>
        <p className="footer-hours"><span>OPENING HOURS</span>Monday to Saturday<br />10:00 am to 7:00 pm</p>
      </div>
      <div className="footer-column footer-social">
        <span className="eyebrow">FOLLOW ALONG</span>
        <a className="social-link" href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram <ArrowUpRight size={14} /></a>
        <p className="footer-note">A thoughtful pause in the heart of Gulberg.</p>
      </div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Élan Beauty Studio</span><span>Made for your moment.</span></div>
  </footer>
}

function SectionHeading({ kicker, title, text, centered = false }) {
  return <div className={`section-heading ${centered? 'centered' : ''}`}><span className="eyebrow"><span className="eyebrow-dot" />{kicker}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>
}

function ServiceCard({ service, index }) {
  return <article className="service-card" style={{ '--delay': `${index * 65}ms` }}>
    <Link to={`/book?service=${encodeURIComponent(service.id)}`} className="service-image-wrap" aria-label={`Book ${service.name}`}><img src={serviceImage(service.image, 800)} alt={`${service.name} at Élan Beauty Studio`} loading="lazy" /><span className="image-arrow"><ArrowUpRight size={17} /></span><span className="category-tag">{service.category}</span></Link>
    <div className="service-card-info"><div><h3>{service.name}</h3><span className="service-duration"><Clock3 size={13} /> {service.duration} min</span></div><span className="service-price">{formatPrice(service.price)}</span></div>
    <Link to={`/book?service=${encodeURIComponent(service.id)}`} className="service-book-link">Book this service <ArrowRight size={13} /></Link>
  </article>
}

function Home() {
  const { services } = useServices()
  const featured = [services[0], services[2], services[5], services[7]].filter(Boolean)
  const featuredSliderRef = useRef(null)
  const scrollFeatured = (direction) => {
    const track = featuredSliderRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.82, behavior: 'smooth' })
  }
  const heroSlides = [
    { src: '/images/hero.jpg', alt: 'A quiet, sunlit salon moment' },
    { src: '/images/hero1.jpg', alt: 'A considered beauty studio experience' },
    { src: '/images/hero2.jpg', alt: 'The warm, welcoming ELAN salon interior' },
  ]
  const [activeHeroSlide, setActiveHeroSlide] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [])

  return <main>
    <section className="hero" aria-label="ELAN Beauty Studio">
      <div className="hero-media" style={{ aspectRatio: '1671 / 941' }}>
        {heroSlides.map((slide, index) => <img key={slide.src} className={'hero-image' + (index === activeHeroSlide ? ' is-active' : '')} src={slide.src} alt={slide.alt} aria-hidden={index !== activeHeroSlide} fetchpriority={index === 0 ? 'high' : 'auto'} />)}
      </div>
      <div className="hero-panel">
        <div className="hero-content">
          <span className="hero-overline"><span className="overline-line" /> A BEAUTY STUDIO IN GULBERG, LAHORE</span>
          <h1>Beauty, with <em>intention.</em></h1>
          <p>A considered little escape to reconnect with yourself, feel taken care of, and leave feeling more like you.</p>
        </div>
      </div>
    </section>
    <section className="intro-section" id="about" aria-labelledby="intro-title">
      <figure className="intro-photo">
        <img src="/images/interior.png" alt="A calm, light-filled interior at Élan Beauty Studio" loading="lazy" />
      </figure>
      <div className="intro-copy">
        <span className="intro-index">01 <span /> THE ÉLAN FEELING</span>
        <h2 className="intro-lead" id="intro-title">Beauty isn't about becoming someone else.<br /><em>It's about feeling at home in yourself.</em></h2>
        <p className="intro-support">At Élan, every detail is considered and every visit is yours. Come as you are, take a breath, and leave with a little more room to shine.</p>
        <Link to="/services" className="underlined-link">A little about what we do <ArrowRight size={15} /></Link>
      </div>
    </section>
    <section className="featured-section">
      <div className="section-row">
        <SectionHeading kicker="A FEW FAVOURITES" title={<>A little care, <em>beautifully done.</em></>} text="Thoughtful treatments, a gentle touch, and time that feels like your own." />
        <div className="featured-heading-actions">
          <Link to="/services" className="underlined-link section-link">View all services <ArrowRight size={15} /></Link>
          <div className="featured-slider-controls" role="group" aria-label="Browse featured services">
            <button type="button" aria-label="Previous featured services" onClick={() => scrollFeatured(-1)}><ArrowLeft size={17} /></button>
            <button type="button" aria-label="Next featured services" onClick={() => scrollFeatured(1)}><ArrowRight size={17} /></button>
          </div>
        </div>
      </div>
      <div className="featured-carousel">
        <div className="service-grid featured-grid" ref={featuredSliderRef} aria-label="Featured services">{featured.map((service, i) => <ServiceCard key={service.id} service={service} index={i} />)}</div>
      </div>
    </section>
    <WhyElan />
    <Testimonials />
  </main>
}

function WhyElan() {
  const images = [
    { src: '/images/sidebar1.jpg', alt: 'A quiet detail from the ELAN studio' },
    { src: '/images/sidebar2.jpg', alt: 'A considered treatment space at ELAN' },
    { src: '/images/sidebar3.jpg', alt: 'Soft light across the salon interior' },
    { src: '/images/sidebar4.jpg', alt: 'A welcoming corner of the beauty studio' },
  ]
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setActiveImage((current) => (current + 1) % images.length), 2500)
    return () => window.clearInterval(timer)
  }, [])

  return <section className="promise-section" id="why-us" aria-label="Why choose ELAN">
    <div className="promise-image">
      <div className="why-image-window">
        {images.map((image, index) => <img key={image.src} className={'why-image-slide' + (index === activeImage ? ' is-active' : '')} src={image.src} alt={image.alt} loading={index === 0 ? 'eager' : 'lazy'} aria-hidden={index !== activeImage} />)}
      </div>
    </div>
    <div className="promise-copy">
      <span className="eyebrow"><span className="eyebrow-dot" /> WHY ÉLAN</span>
      <h2>Care you can<br /><em>feel.</em></h2>
      <p className="promise-description">The best appointments are about more than the final look. They're about how you feel while you're here, and how you feel when you leave.</p>
      <div className="promise-points">
        <div className="promise-point"><span>01</span><div><h3>Made personal</h3><p>We listen first, then make a plan that feels right for you.</p></div></div>
        <div className="promise-point"><span>02</span><div><h3>Never rushed</h3><p>Space to settle in, feel at ease, and enjoy the moment.</p></div></div>
        <div className="promise-point"><span>03</span><div><h3>Thoughtfully chosen</h3><p>Professional care and a gentle approach, every visit.</p></div></div>
      </div>
      <Link to="/services" className="underlined-link">Find your feel-good ritual <ArrowRight size={15} /></Link>
    </div>
  </section>
}

const testimonialItems = [
  { name: 'Ayesha R.', service: 'Hair styling', quote: 'The appointment felt calm from the moment I arrived. My stylist listened closely, and I left looking like myself, just a little more polished.' },
  { name: 'Mariam S.', service: 'Facial', quote: 'Everything was thoughtful and unhurried. I felt looked after throughout, and the results were exactly what my skin needed.' },
  { name: 'Zara H.', service: 'Manicure', quote: 'A beautiful space and such a gentle touch. It was lovely to have a little time to myself and leave feeling refreshed.' },
]

function Testimonials() {
  const [activeReview, setActiveReview] = useState(0)
  const changeReview = (direction) => setActiveReview((current) => (current + direction + testimonialItems.length) % testimonialItems.length)

  useEffect(() => {
    const timer = window.setInterval(() => changeReview(1), 6000)
    return () => window.clearInterval(timer)
  }, [])

  return <section className="testimonials-section" aria-labelledby="testimonials-title">
    <div className="testimonials-heading">
      <span className="eyebrow"><span className="eyebrow-dot" /> KIND WORDS</span>
      <h2 id="testimonials-title">A feeling worth<br /><em>sharing.</em></h2>
    </div>
    <div className="testimonials-carousel">
      <div className="testimonials-viewport">
        <div className="testimonials-track" style={{ transform: 'translateX(-' + (activeReview * 100) + '%)' }}>
          {testimonialItems.map((review) => <article className="testimonial-slide" key={review.name}>
            <span className="testimonial-mark" aria-hidden="true">“</span>
            <blockquote>{review.quote}</blockquote>
            <div className="testimonial-byline"><span>{review.name}</span><span>{review.service}</span></div>
          </article>)}
        </div>
      </div>
      <div className="testimonials-controls">
        <span className="testimonial-count">{String(activeReview + 1).padStart(2, '0')} <span>/</span> {String(testimonialItems.length).padStart(2, '0')}</span>
        <div>
          <button type="button" aria-label="Previous review" onClick={() => changeReview(-1)}><ArrowLeft size={17} /></button>
          <button type="button" aria-label="Next review" onClick={() => changeReview(1)}><ArrowRight size={17} /></button>
        </div>
      </div>
    </div>
  </section>
}
function ServicesPage() {
  const { services } = useServices()
  return <main className="services-page"><div className="services-hero"><Link to="/" className="back-link"><ArrowLeft size={15} /> Back home</Link><span className="eyebrow"><span className="eyebrow-dot" /> THE ÉLAN MENU</span><h1>A little something<br /><em>for yourself.</em></h1><p>Thoughtful treatments, tailored to you. Take a look around and find what feels right.</p><span className="services-count">{services.length} SERVICES <span>·</span> GULBERG, LAHORE</span></div><div className="services-list"><div className="services-toolbar"><span>OUR SERVICES</span><span>TIME WELL SPENT <ArrowDown size={13} /></span></div><div className="service-grid all-services-grid">{services.map((service, i) => <ServiceCard key={service.name} service={service} index={i} />)}</div></div><div className="services-note"><span className="eyebrow"><span className="eyebrow-dot" /> A LITTLE NOTE</span><p>Every visit is personal. If you have a question about a treatment, we'd love to hear from you.</p><a href="mailto:hello@elanbeautystudio.pk" className="underlined-link">Get in touch <ArrowRight size={15} /></a></div></main>
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  return <><ScrollToTop /><Header /><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/services" element={<ServicesPage />} />
    <Route path="/book" element={<BookingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/signup" element={<AuthPage mode="signup" />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/dashboard" element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>} />
    <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><Footer /></>
}

export default App
