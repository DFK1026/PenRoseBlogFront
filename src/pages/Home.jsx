import React, { useEffect } from 'react';
import '../components/home/styles/Home.css';

const Home = () => {
  useEffect(() => {
    document.body.classList.add('home-bg');
    return () => {
      document.body.classList.remove('home-bg');
    };
  }, []);
  return (
    <div className="home-container">
    </div>
  );
};

export default Home;
