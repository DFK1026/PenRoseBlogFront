import React from "react";
import MainPageNav from "../components/mainpagecomponents/MainPageNav";

const MainPage = () => {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <MainPageNav />
      <div style={{ paddingTop: 80 }}>
          {/* 主内容区，可扩展 */}
      </div>
    </div>
  );
};

export default MainPage;
