import React, { useRef, useState, useEffect } from "react";
import musicplayerStyle from "./styles/musicplayer/musicplayerstyle";
// SVG 图标组件
const Icon = ({ name, style }) => (
  <img src={`/icons/musicplayer/${name}.svg`} alt={name} style={{ width: 28, height: 28, verticalAlign: 'middle', ...style }} />
);

// 播放模式枚举
const PLAY_MODE = {
  SINGLE: "single", // 单曲循环
  LIST: "list"      // 列表循环
};

const RESUME_EVENT = 'app:resume-audio-context';

export default function MusicPlayer({ userId, refreshKey = 0 }) {
  // 音乐名称自适应字体
  const musicNameRef = useRef(null);
  // 背景动态偏移（随鼠标移动）
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });
  const bgAreaRef = useRef(null);
  // 鼠标移动时计算偏移百分比（-20%~+20%）
  const handleBgMouseMove = e => {
    if (!bgAreaRef.current) return;
    const rect = bgAreaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const maxX = rect.width * 0.20;
    const maxY = rect.height * 0.15;
    setBgOffset({
      x: Math.max(-maxX, Math.min(maxX, ((x / rect.width) - 0.5) * rect.width * 0.3)),
      y: Math.max(-maxY, Math.min(maxY, ((y / rect.height) - 0.5) * rect.height * 0.2))
    });
  };
  const handleBgMouseLeave = () => setBgOffset({ x: 0, y: 0 });
  // 播放器相关状态
  const [playlist, setPlaylist] = useState([]); // 音乐列表
  const [bgList, setBgList] = useState([]); // 背景列表
  const [currentIdx, setCurrentIdx] = useState(0); // 当前播放索引
  const [playMode, setPlayMode] = useState(PLAY_MODE.LIST); // 播放模式
  const [volume, setVolume] = useState(0.5); // 音量，默认50%
  const [progress, setProgress] = useState(0); // 当前进度（秒）
  const [isPlaying, setIsPlaying] = useState(false); // 是否正在播放，默认不播放
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false); // 播放列表展开状态
  const [uiMsg, setUiMsg] = useState(""); // 轻提示信息
  const audioRef = useRef(null);

  // 获取音乐列表和背景：监听 userId 与 refreshKey；refreshKey 变化时强制刷新列表
  useEffect(() => {
    if (!userId) return;
    const normalize = (resp) => {
      if (!resp) return [];
      if (Array.isArray(resp)) return resp;
      if (Array.isArray(resp.data)) return resp.data;
      if (Array.isArray(resp.list)) return resp.list;
      return [];
    };
    Promise.all([
      fetch(`/api/usermusic/list?userId=${userId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/usermusicbg/list?userId=${userId}`).then(r => r.json()).catch(() => []),
    ]).then(([musics, bgs]) => {
      const musicArr = normalize(musics);
      const bgArr = normalize(bgs);
      setPlaylist(musicArr);
      setBgList(bgArr);
      // 刷新后，若当前索引越界或列表从空变为非空，重置为第一首并暂停
      setCurrentIdx(idx => {
        const nextLen = musicArr.length;
        if (nextLen === 0) return 0;
        return Math.min(idx, Math.max(0, nextLen - 1));
      });
      setIsPlaying(false);
      if (musicArr.length === 0) {
        setUiMsg("暂无可播放的音乐");
        window.clearTimeout(setUiMsg._t);
        setUiMsg._t = window.setTimeout(() => setUiMsg(""), 2000);
      }
    });
  }, [userId, refreshKey]);

  // 音乐切换时重置进度和时长
  useEffect(() => {
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.load();
      // 切歌时根据 isPlaying 状态决定是否自动播放
      if (isPlaying) {
        // 触发全局恢复，再尝试播放
        try { window.dispatchEvent(new Event(RESUME_EVENT)); } catch {}
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentIdx]);

  // 音量调整
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      // 确保未被意外静音
      audioRef.current.muted = false;
    }
  }, [volume]);

  // 将 audio 元素通知给全局（供可视化组件使用）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const fire = () => {
      try {
        window.dispatchEvent(new CustomEvent('app:audio-element', { detail: { audio } }));
      } catch {}
    };
    // 初次和切歌后立即尝试派发一次
    fire();
    audio.addEventListener('loadedmetadata', fire);
    audio.addEventListener('play', fire);
    return () => {
      audio.removeEventListener('loadedmetadata', fire);
      audio.removeEventListener('play', fire);
    };
  }, [currentIdx]);

  // 进度条拖动
  const handleProgressChange = e => {
    const val = Number(e.target.value);
    setProgress(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  // 音量条拖动
  const handleVolumeChange = e => {
    setVolume(Number(e.target.value));
  };

  // 切换播放/暂停（立即同步 isPlaying 状态，保证按钮图标及时切换）
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentMusic || !currentMusic.musicPath) {
      setUiMsg("暂无可播放的音乐");
      window.clearTimeout(setUiMsg._t);
      setUiMsg._t = window.setTimeout(() => setUiMsg(""), 1800);
      return;
    }
    // 主动恢复音频上下文（配合 AudioVisualizer 单例）
    try { window.dispatchEvent(new Event(RESUME_EVENT)); } catch {}
    if (audio.paused) {
      const p = audio.play();
      // 某些浏览器需要用户手势；这里在点击中触发，若仍失败则输出日志
      if (p && typeof p.then === 'function') {
        p.then(() => setIsPlaying(true)).catch(err => {
          // eslint-disable-next-line no-console
          console.warn('Audio play blocked or failed:', err);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  // 自动同步 isPlaying 状态（防止外部触发播放/暂停时图标不同步）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audioRef]);

  // 切换播放模式
  const handleModeSwitch = () => {
    setPlayMode(mode => mode === PLAY_MODE.SINGLE ? PLAY_MODE.LIST : PLAY_MODE.SINGLE);
  };

  // 切换上一首/下一首
  const handlePrev = () => {
    setCurrentIdx(idx => idx === 0 ? (playlist.length ? playlist.length - 1 : 0) : idx - 1);
  };
  const handleNext = () => {
    setCurrentIdx(idx => (playlist.length ? (idx + 1) % playlist.length : 0));
  };

  // 音乐播放结束
  const handleEnded = () => {
    if (playMode === PLAY_MODE.SINGLE) {
      audioRef.current.currentTime = 0;
      try { window.dispatchEvent(new Event(RESUME_EVENT)); } catch {}
      audioRef.current.play().catch(() => {});
    } else {
      setCurrentIdx(idx => {
        const nextIdx = playlist.length ? (idx + 1) % playlist.length : 0;
        setTimeout(() => { if (audioRef.current) { try { window.dispatchEvent(new Event(RESUME_EVENT)); } catch {} audioRef.current.play().catch(() => {}); } }, 0);
        return nextIdx;
      });
    }
  };

  // 进度更新
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleAudioError = () => {
    const el = audioRef.current;
    // eslint-disable-next-line no-console
    console.warn('Audio element error', el?.error, 'src=', el?.currentSrc);
    setUiMsg("音频播放失败，请检查资源是否可访问");
    window.clearTimeout(setUiMsg._t);
    setUiMsg._t = window.setTimeout(() => setUiMsg(""), 2500);
  };

  // 获取当前音乐和背景
  const currentMusic = playlist[currentIdx];
  const currentBg = bgList.find(bg => bg.musicId === currentMusic?.id);

  // 音乐名称字体自适应
  useEffect(() => {
    const el = musicNameRef.current;
    if (!el) return;
    el.style.fontSize = "1.5rem";
    let parentWidth = el.parentNode.offsetWidth;
    let fontSize = 24;
    el.style.fontSize = fontSize + "px";
    el.style.whiteSpace = "nowrap";
    el.style.overflow = "hidden";
    el.style.textOverflow = "ellipsis";
    while (el.scrollWidth > parentWidth && fontSize > 12) {
      fontSize -= 1;
      el.style.fontSize = fontSize + "px";
    }
  }, [currentMusic?.musicName]);

  // 判断背景类型
  let bgType = "none";
  if (currentBg && currentBg.bgPath) {
    const lower = currentBg.bgPath.toLowerCase();
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg')) {
      bgType = "video";
    } else if (lower.endsWith('.gif')) {
      bgType = "gif";
    } else {
      bgType = "image";
    }
  }

  // 计算动态偏移百分比（-20%~+20%）
  const offsetPercent = {
    x: Math.max(-20, Math.min(20, (bgOffset.x / 400) * 40)),
    y: Math.max(-20, Math.min(20, (bgOffset.y / 300) * 40)),
  };

  return (
    <div
      ref={bgAreaRef}
      style={{ ...musicplayerStyle.container, position: 'relative', height: '100%' }}
      onMouseMove={handleBgMouseMove}
      onMouseLeave={handleBgMouseLeave}
    >
      {/* 背景层 */}
      {bgType === "video" && (
        <video
          src={currentBg.bgPath}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={{
            ...musicplayerStyle.bgMedia,
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${50 + offsetPercent.x}% ${50 + offsetPercent.y}%`,
            zIndex: 0
          }}
        />
      )}
      {(bgType === "image" || bgType === "gif") && (
        <div
          style={{
            ...musicplayerStyle.bgMedia,
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            background: `url(${currentBg.bgPath}) center center/cover no-repeat`,
            backgroundPosition: `${50 + offsetPercent.x}% ${50 + offsetPercent.y}%`,
            zIndex: 0
          }}
        />
      )}
      {/* 内容层 */}
      <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
        {/* 歌曲名称 */}
        <div style={musicplayerStyle.infoArea}>
          <div style={musicplayerStyle.marqueeWrapper}>
            <div style={musicplayerStyle.marqueeText}>
              {currentMusic?.musicName || "未选择音乐"}
            </div>
            <style>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-100%); }
              }
            `}</style>
          </div>
        </div>
        {/* 播放进度条 */}
        <div style={musicplayerStyle.progressBarArea}>
          <audio
            ref={audioRef}
            src={currentMusic?.musicPath}
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
            onError={handleAudioError}
            onCanPlay={() => {
              // 可播放时清理可能的提示
              setUiMsg("");
            }}
            crossOrigin="anonymous"
            preload="metadata"
          />
          <input
            type="range"
            min={0}
            max={currentMusic?.duration || (audioRef.current && audioRef.current.duration) || 0}
            value={progress}
            onChange={handleProgressChange}
            style={musicplayerStyle.progressSlider}
          />
        </div>
        {/* 进度时间显示，居中放在进度条下方 */}
        <div style={{ width: '100%', textAlign: 'center', margin: '4px 0 12px 0' }}>
          <span style={musicplayerStyle.duration}>
            {currentMusic ? `${Math.floor(progress)}/${currentMusic.duration}s` : "0/0s"}
          </span>
        </div>
        {/* 控制按钮区 */}
        <div style={musicplayerStyle.controlsArea}>
          <button style={musicplayerStyle.controlBtn} onClick={handleModeSwitch}>
            {playMode === PLAY_MODE.SINGLE ? <Icon name="singleloop" /> : <Icon name="listloop" />}
          </button>
          <button style={musicplayerStyle.controlBtn} onClick={handlePrev} disabled={playlist.length === 0}>
            <Icon name="last" />
          </button>
          <button style={musicplayerStyle.controlBtn} onClick={handlePlayPause} disabled={playlist.length === 0}>
            {isPlaying ? <Icon name="start" /> : <Icon name="pause" />}
          </button>
          <button style={musicplayerStyle.controlBtn} onClick={handleNext} disabled={playlist.length === 0}>
            <Icon name="next" />
          </button>
          <button style={musicplayerStyle.controlBtn} onClick={() => setIsPlaylistOpen(v => !v)}>
            <Icon name="musiclist" />
          </button>
        </div>
        {/* 轻提示 */}
        {uiMsg && (
          <div style={{ textAlign: 'center', color: '#374151', fontSize: 12, marginTop: 6 }}>{uiMsg}</div>
        )}
        {/* 音量调节条 */}
        <div style={musicplayerStyle.volumeArea}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            style={musicplayerStyle.volumeSlider}
          />
        </div>
        {/* 音乐列表区域（展开/收起） */}
        {isPlaylistOpen && (
          <div style={musicplayerStyle.playlistAreaPopup}>
            <div style={musicplayerStyle.playlistHeader}>
              <Icon name="musiclist" style={musicplayerStyle.musicListIcon} />
              <span style={musicplayerStyle.musicListTitle}>音乐列表</span>
            </div>
            <div style={musicplayerStyle.playlistContent}>
              {playlist.length === 0 ? (
                <div style={musicplayerStyle.noMusicTip}>暂无音乐</div>
              ) : playlist.map((music, idx) => (
                <div
                  key={music.id}
                  style={{ ...musicplayerStyle.playlistItem, ...(idx === currentIdx ? musicplayerStyle.playlistItemActive : {}) }}
                  onClick={() => setCurrentIdx(idx)}
                >
                  <Icon name="music" style={musicplayerStyle.musicIcon} />
                  {music.musicName}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
