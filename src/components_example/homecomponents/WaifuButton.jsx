import React from "react";
import styles from "./styles/waifubutton/waifubutton";

/**
 * WaifuButton 看板娘召唤/收起按钮
 * @param {boolean} showWaifu 是否显示看板娘
 * @param {function} onToggle 点击切换显示/隐藏
 * @param {string} btnState 按钮状态 default | hover | active | close
 * @param {function} setBtnState 设置按钮状态
 */
export default function WaifuButton({ showWaifu, onToggle, btnState, setBtnState }) {
  return (
    <div
      style={styles.waifuButton}
      onMouseEnter={e => {
        e.stopPropagation();
        setBtnState(showWaifu ? "close" : "hover");
      }}
      onMouseLeave={e => {
        e.stopPropagation();
        setBtnState(showWaifu ? "active" : "default");
      }}
      onClick={onToggle}
    >
      <img
        src={
          btnState === "default"
            ? "/icons/waifu/waifu0.svg"
            : btnState === "hover"
            ? "/icons/waifu/waifu1.svg"
            : btnState === "active"
            ? "/icons/waifu/waifu1.svg"
            : btnState === "close"
            ? "/icons/waifu/waifu2.svg"
            : "/icons/waifu/waifu0.svg"
        }
        alt="看板娘召唤"
        style={{ width: 64, height: 64, transition: "0.2s" }}
      />
    </div>
  );
}
