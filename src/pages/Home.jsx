import Maid from '../components/home/maid/Maid';
import '../styles/home/Home.css';

const Home = () => {
  return (
    <>
      <div className="page-container">
        <h1 className="hero-title">Home</h1>
        <p className="hero-subtitle">欢迎来到主页</p>
        {/* 这里可以放主页内容模块，例如文章列表、卡片等 */}
      </div>
      <Maid />
    </>
  );
};

export default Home;
