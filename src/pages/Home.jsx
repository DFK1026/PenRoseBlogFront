import React, { useRef } from 'react';
import Maid from '../components/home/maid/Maid';
import '../styles/home/Home.css';
import BannerNavbar from '../components/common/BannerNavbar';

const Home = () => {
  const heroRef = useRef(null);

  return (
    <>
      <BannerNavbar bannerId={undefined} />
      <section ref={heroRef} className="home-main-full" aria-label="主页内容">
      </section>
      <Maid />
    </>
  );
};

export default Home;
