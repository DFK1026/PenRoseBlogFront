import React, { useRef } from 'react';
import Maid from '../components/home/maid/Maid';
import '../styles/home/Home.css';
import BannerNavbar from '../components/common/BannerNavbar';

const Home = () => {
  const heroRef = useRef(null);

  // 导航滚动显隐逻辑已迁移到 SiteNavbar 组件

  return (
    <>
      {/* 顶部导航栏：上下滑显隐，背景始终透明 */}
  <BannerNavbar bannerId={undefined} />

      {/* 欢迎区域：占满整个视窗，高度 100vh */}
      <section ref={heroRef} className="home-hero-full" aria-label="欢迎区域">
        <div className="hero-center">
          <h1 className="welcome-title">欢迎区域</h1>
        </div>
      </section>
      {/* 与欢迎区域相同大小的内容区域 */}
      <section className="home-content-full" aria-label="内容区域">
        <div className="hero-center">
          <h2 className="welcome-title">内容区域</h2>
        </div>
      </section>
      <Maid />
    </>
  );
};

export default Home;
