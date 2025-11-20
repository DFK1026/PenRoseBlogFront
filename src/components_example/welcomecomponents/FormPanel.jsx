import React from "react";
import { welcomeStyles } from "./styles/WelcomeStyles";

export default function FormPanel({ type, username, password, loading, msg, onUsernameChange, onPasswordChange, onSubmit }) {
	return (
		<>
			<h2 style={welcomeStyles.formPanelTitle}>
				{type === "login" ? "准备登录" : "创建账号"}
			</h2>
			<div style={welcomeStyles.formPanelSubtitle}>
				{type === "login" ? "欢迎回来！" : "快来注册吧！"}
			</div>
			<form
				onSubmit={onSubmit}
				style={welcomeStyles.formPanelForm}
			>
				<input
					type="text"
					placeholder="用户名"
					value={username}
					onChange={onUsernameChange}
					style={welcomeStyles.formPanelInput}
					required
					disabled={loading}
				/>
				<input
					type="password"
					placeholder="密码"
					value={password}
					onChange={onPasswordChange}
					style={welcomeStyles.formPanelInput}
					required
					disabled={loading}
				/>
				{type === "register" && (
					<div style={welcomeStyles.passwordTip}>
						密码需8-12位，必须包含字母和数字，不支持特殊字符
					</div>
				)}
				<button
					type="submit"
					style={welcomeStyles.formPanelBtnSubmit}
					disabled={loading}
				>
					{loading
						? (type === "login" ? "登录中..." : "注册中...")
						: (type === "login" ? "SIGN IN" : "SIGN UP")}
				</button>
				{msg && <div style={welcomeStyles.formPanelMsg}>{msg}</div>}
			</form>
		</>
	);
}