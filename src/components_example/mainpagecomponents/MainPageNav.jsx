import React from "react";
import mainPageNavStyles from "./styles/mainpagenav/mainpagenav";

const HomeIcon = ({ active, onClick }) => (
  <button
    onClick={onClick}
    style={
      active
        ? { ...mainPageNavStyles.homeIcon, ...mainPageNavStyles.homeIconActive }
        : { ...mainPageNavStyles.homeIcon, ...mainPageNavStyles.homeIconInactive }
    }
    disabled={active}
    title="首页"
  >
    <img
      src="/icons/nav/home.svg"
      alt="首页"
      style={mainPageNavStyles.iconImg}
    />
  </button>
);

const SelfSpaceIcon = ({ onClick }) => (
  <button
    onClick={onClick}
    style={mainPageNavStyles.homeIcon}
    title="个人空间"
  >
    <img
      src="/icons/nav/selfspace.svg"
      alt="个人空间"
      style={mainPageNavStyles.iconImg}
    />
  </button>
);

const MainPageNav = ({ isHome, siteName = "MyDear" }) => {
  const handleHomeClick = () => {
    if (!isHome) {
      window.location.href = "/mainpage";
    }
  };
  const handleSelfSpaceClick = () => {
    window.location.href = "/home";
  };

  return (
    <nav style={mainPageNavStyles.nav}>
      <div style={mainPageNavStyles.left}>
        <div style={mainPageNavStyles.title}>{siteName}</div>
      </div>
      <div style={mainPageNavStyles.iconWrapper}>
        <HomeIcon active={isHome} onClick={handleHomeClick} />
        <SelfSpaceIcon onClick={handleSelfSpaceClick} />
      </div>
      <div style={mainPageNavStyles.right} />
    </nav>
  );
};

export default MainPageNav;
