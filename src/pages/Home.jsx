import React, { useEffect, useState } from 'react';
import Maid from '../components/home/maid/Maid';
import '../styles/home/Home.css';
import BannerNavbar from '../components/common/BannerNavbar';
import ArticleCard from '../components/common/ArticleCard';
import resolveUrl from '../utils/resolveUrl';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [sortMode, setSortMode] = useState('latest'); // 'latest' | 'hot'
  const size = 5; // 每页 5 篇
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    let mounted = true;
    fetch(`/api/blogpost?page=${page}&size=${size}${userId?`&currentUserId=${userId}`:''}`)
      .then(r=>r.json())
      .then(async j=>{
        if (!mounted) return;
        if(j && j.code===200){
          let list = j.data.list || [];
          if (sortMode === 'hot' && list.length) {
            // 并行获取每篇的浏览量，然后按自定义热度 score 排序
            try {
              const ids = list.map(p => (p.id || p.postId));
              const promises = ids.map(id =>
                fetch(`/api/blogview/${id}`).then(r => r.ok ? r.json() : null).catch(()=>null)
              );
              const results = await Promise.all(promises);
              const viewMap = new Map();
              results.forEach((res, idx) => {
                const id = ids[idx];
                const v = (res && res.code===200 && res.data) ? Number(res.data.viewCount||0) : 0;
                viewMap.set(String(id), v);
              });
              // 评分策略：score = viewCount + likeCount * 50
              list = list.slice().sort((a,b) => {
                const va = (viewMap.get(String(a.id || a.postId)) || 0) + ((a.likeCount||a.likes||0) * 30);
                const vb = (viewMap.get(String(b.id || b.postId)) || 0) + ((b.likeCount||b.likes||0) * 30);
                return vb - va;
              });
            } catch (e) {
              // 若获取 view 失败则回退到后端顺序（不阻塞）
              console.error('[hot排序] 获取浏览量失败', e);
            }
          }
          setPosts(list);
        }
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, [page, size, userId, sortMode]);

  const featured = posts && posts.length ? posts[0] : null;
  const rest = posts && posts.length ? posts.slice(1) : [];

  return (
    <>
      <BannerNavbar bannerId={undefined} />
      <div className="home-main-full">
        <div className="home-articles-container">
          <div className="home-articles-title-out">
            <div className="home-sort-group" role="tablist" aria-label="文章排序">
              <button
                className={`home-sort-btn${sortMode==='latest' ? ' active' : ''}`}
                onClick={() => setSortMode('latest')}
                aria-pressed={sortMode==='latest'}
              >
                最新文章
              </button>
              <button
                className={`home-sort-btn${sortMode==='hot' ? ' active' : ''}`}
                onClick={() => setSortMode('hot')}
                aria-pressed={sortMode==='hot'}
              >
                最热文章
              </button>
            </div>
          </div>
           <div className="home-articles-list">
             {posts.length === 0 ? (
               <div className="home-articles-empty">暂无文章</div>
             ) : (
               <>
                 {featured && (
                   <ArticleCard key={featured.id} post={featured} className="home-article-card" />
                 )}
                 {rest.map(p => (
                   <ArticleCard key={p.id} post={p} className="home-article-card" />
                 ))}
               </>
             )}
           </div>
           <div className="home-pagination">
             <button onClick={() => setPage(Math.max(0, page-1))}>上一页</button>
             <span>第 {page+1} 页</span>
             <button onClick={() => setPage(page+1)}>下一页</button>
           </div>
         </div>
       </div>
       <Maid />
     </>
   );
 };

 export default Home;