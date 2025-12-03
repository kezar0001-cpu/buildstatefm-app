import { Link } from 'react-router-dom';
import '../index.css';

const BlogPublicNav = () => {
  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      backgroundColor: 'white',
      zIndex: 1000,
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      marginBottom: 0,
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden'
    }}>
      <div className="landing-nav" style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '1rem clamp(1rem, 4vw, 2rem)',
      }}>
        <Link to="/" className="landing-logo" aria-label="Buildstate FM home">
          Buildstate FM
        </Link>
        <div className="landing-nav-links">
          <a href="/#features">Features</a>
          <a href="/#how-it-works">How It Works</a>
          <Link to="/pricing">Pricing</Link>
          <Link to="/blog">Blog</Link>
        </div>
        <div className="landing-nav-cta">
          <Link to="/signin" className="landing-link">
            Sign in
          </Link>
          <Link to="/signup" className="landing-button">
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default BlogPublicNav;
