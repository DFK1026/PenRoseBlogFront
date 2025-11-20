import React from "react";
import downButtonStyle from "./styles/downbutton/downbuttonstyle";

export default function DownButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={downButtonStyle}
      aria-label="下行"
    >
      <img src="/icons/down.svg" alt="" width="28" height="28" draggable="false" loading="lazy" decoding="async" />
    </button>
  );
}
