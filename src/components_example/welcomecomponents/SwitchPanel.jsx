import React from "react";
import { welcomeStyles } from "./styles/WelcomeStyles";

export default function SwitchPanel({ type, onClick, loading }) {
	return (
		<div style={welcomeStyles.switchPanel}>
			<div style={welcomeStyles.switchPanelInner}>
				<h2 style={welcomeStyles.switchPanelTitle}>
					{type === "toRegister" ? "还没有账号？" : "已有账号？"}
				</h2>
				<div style={welcomeStyles.switchPanelSubtitle}>
					{type === "toRegister" ? "点击下方按钮注册新账号" : "点击下方按钮返回登录"}
				</div>
				<button
					type="button"
					style={welcomeStyles.switchPanelBtn(loading)}
					onClick={onClick}
					disabled={loading}
				>
					{type === "toRegister" ? "去注册" : "去登录"}
				</button>
			</div>
		</div>
	);
}