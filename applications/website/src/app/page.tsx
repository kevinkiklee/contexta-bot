import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Features from '../components/Features';
import SeeItInAction from '../components/SeeItInAction';
import HowItWorks from '../components/HowItWorks';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <Nav />
      <Hero />
      <Features />
      <SeeItInAction />
      <HowItWorks />
      <FinalCTA />
      <Footer />
    </main>
  );
}
