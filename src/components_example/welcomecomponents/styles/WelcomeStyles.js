export const welcomeStyles = {
	backgroundMediaBase: {
		position: "absolute",
		top: 0,
		left: 0,
		width: "100vw",
		height: "100vh",
		objectFit: "cover",
		transition:
			"opacity 0.5s cubic-bezier(.25,.46,.45,.94), transform 0.5s cubic-bezier(.25,.46,.45,.94)",
		pointerEvents: "none",
		willChange: "opacity, transform",
		backfaceVisibility: "hidden",
		backgroundColor: "#000",
	},
	switchPanel: {
		width: 320,
		height: 520,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'flex-end',
		boxShadow: '0 8px 32px 0 rgba(31,38,135,0.18)',
		background: 'rgba(255,255,255,0.35) url("/images/spbg01.png") center/cover no-repeat',
		backdropFilter: 'blur(12px)',
		WebkitBackdropFilter: 'blur(12px)',
		position: 'relative',
		overflow: 'hidden',
		border: '1.5px solid #e0e7ef',
		paddingBottom: 40,
	},
	switchPanelInner: {
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
	},
	switchPanelTitle: {
		fontSize: 32,
		fontWeight: 700,
		color: '#222',
		textShadow: '0 2px 8px #fff',
		marginBottom: 0,
	},
	switchPanelSubtitle: {
		fontSize: 15,
		color: '#666',
		textAlign: 'center',
		textShadow: '0 1px 4px #fff',
		marginBottom: 0,
	},
	switchPanelBtn: (loading) => ({
		height: 44,
		fontSize: 18,
		borderRadius: 22,
		background: loading ? '#2563eb' : '#3b82f6',
		color: '#fff',
		fontWeight: 700,
		border: 'none',
		marginTop: 18,
		boxShadow: '0 2px 8px rgba(59,130,246,0.10)',
		cursor: 'pointer',
		transition: 'background 0.2s',
		width: 180,
		opacity: loading ? 0.7 : 1,
	}),
	formPanelTitle: {
		fontSize: 32,
		fontWeight: 700,
		marginBottom: 12,
		color: '#222',
	},
	formPanelSubtitle: {
		fontSize: 15,
		color: '#666',
		marginBottom: 32,
		textAlign: 'center',
	},
	formPanelForm: {
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		gap: 18,
	},
	formPanelInput: {
		height: 44,
		fontSize: 16,
		borderRadius: 8,
		border: '1px solid #e0e7ef',
		padding: '0 16px',
		marginBottom: 8,
	},
	formPanelBtnSubmit: {
		height: 44,
		fontSize: 18,
		borderRadius: 8,
		background: '#3b82f6',
		color: '#fff',
		fontWeight: 700,
		border: 'none',
		marginTop: 8,
		boxShadow: '0 2px 8px rgba(59,130,246,0.10)',
		cursor: 'pointer',
		transition: 'background 0.2s',
	},
	formPanelMsg: {
		textAlign: 'center',
		color: '#e53e3e',
		fontSize: 13,
		marginTop: 8,
	},
	previewCarouselRootVertical: {
		position: "relative",
		width: 160,
		height: 480,
		perspective: "1200px",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	previewCarouselInnerVertical: {
		position: "absolute",
		left: 0,
		top: 0,
		width: 160,
		height: 480,
		pointerEvents: "none",
	},
	previewItemConstVertical: {
		left: 20,
		top: 210,
		itemW: 120,
		itemH: 72,
		radius: 140,
		transition: "all 0.45s cubic-bezier(.25,.46,.45,.94)",
	},
	previewItemStyle: ({ isActive, opacity, scale, z, angle, borderGradient, orientation }) => {
		const vertical = orientation === 'vertical';
		const { left, top, itemW, itemH, radius, transition } = vertical
			? welcomeStyles.previewItemConstVertical
			: welcomeStyles.previewItemConst;
		return {
			position: "absolute",
			left,
			top,
			width: itemW,
			height: itemH,
			borderRadius: 0,
			overflow: "hidden",
			background: "#fff",
			boxShadow: isActive ? "0 0 14px 0 #fff, 0 0 32px 0 #3b82f6" : "none",
			border: isActive ? "3px solid transparent" : "none",
			opacity,
			zIndex: Math.round(z),
			transform: vertical
				? `scale(${scale}) perspective(1200px) rotateX(${angle}deg) translateZ(${radius}px)`
				: `scale(${scale}) perspective(1200px) rotateY(${angle}deg) translateZ(${radius}px)`,
			transition,
			pointerEvents: "none",
			...(isActive && borderGradient
				? {
						borderImage: `${borderGradient} 1`,
						borderWidth: "3px",
						borderStyle: "solid",
					}
				: {}),
		};
	},
	previewCarouselImg: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
	},
	root: {
		position: "fixed",
		top: 0,
		left: 0,
		width: "100vw",
		height: "100vh",
		overflow: "hidden",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 0,
		backgroundColor: "#000",
	},
	formSliderCenter: {
		position: "absolute",
		left: "50%",
		top: "50%",
		transform: "translate(-50%, -50%)",
		zIndex: 10,
		width: 800,
		height: 420,
		userSelect: "none",
		overflow: "hidden",
		boxShadow: "0 8px 32px 0 rgba(31,38,135,0.18)",
		background: "none",
	},
	formPanelMain: (formBg, formShadow, btnWidth, isLogin) => ({
		position: "absolute",
		top: 0,
		left: 0,
		width: 480,
		height: 420,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		padding: "0 32px",
		boxSizing: "border-box",
		background: formBg,
		boxShadow: formShadow,
		transform: `translateX(${isLogin ? btnWidth : 0}px)`,
		transition: "transform 0.7s cubic-bezier(.25,.46,.45,.94), background 0.7s, box-shadow 0.7s",
		zIndex: 1,
		borderRadius: 0,
	}),
	formPanelBtn: (isLogin, formWidth) => ({
		position: "absolute",
		top: 0,
		left: 0,
		width: 320,
		height: 420,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		padding: "0 32px",
		boxSizing: "border-box",
		background: "#fff",
		boxShadow: isLogin ? "0 2px 24px 0 rgba(59,130,246,0.10)" : "0 2px 16px 0 rgba(31,38,135,0.10)",
		transform: `translateX(${isLogin ? 0 : formWidth}px)`,
		transition: "transform 0.7s cubic-bezier(.25,.46,.45,.94), background 0.7s, box-shadow 0.7s",
		zIndex: 2,
		borderRadius: 0,
	}),
	autochangeBtn: {
		width: 45,
		height: 45,
		borderRadius: "50%",
		background: "rgba(255,255,255,0.85)",
		color: "#fff",
		border: "2px solid #fff",
		boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
		outline: "1px solid #222",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontWeight: "bold",
		fontSize: "22px",
		backdropFilter: "blur(8px)",
		WebkitBackdropFilter: "blur(8px)",
		transition: "all 0.2s, opacity 0.2s",
	},
	autochangeBtnContainer: {
		position: "absolute",
		right: 32,
		bottom: 5,
		zIndex: 20,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
	},
	autochangeText: {
		fontSize: 11,
		color: '#fff',
		fontWeight: 'bold',
		letterSpacing: '1px',
		textShadow: '0 0 8px #3b82f6,0 0 2px #fff',
		WebkitTextStroke: '1px #222',
		textStroke: '1px #222',
	},
	previewContainerTopLeft: {
		position: "absolute",
		left: 24,
		top: 24,
		zIndex: 10,
		width: 160,
		height: 480,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		pointerEvents: "auto",
		userSelect: "none",
	},
	formBgActive: "rgba(255,255,255,0.55)",
	formBgInactive: "rgba(255,255,255,0.35)",
	formShadowActive: "0 2px 16px 0 rgba(31,38,135,0.10)",
	formShadowInactive: "0 2px 8px 0 rgba(31,38,135,0.05)",
	autochangeBtnGap: { height: 8 },
	passwordTip: {
		color: '#888',
		fontSize: '0.9em',
		marginBottom: '8px',
	},
};
export const welcomeClassStyles = `
	.form-slider-center {
		box-shadow: 0 8px 32px 0 rgba(31,38,135,0.18);
	}
	.form-panel input:focus {
		outline: 2px solid #3b82f6;
		box-shadow: 0 0 0 2px #3b82f633;
	}
	.form-panel button:active {
		background: #2563eb;
	}
	.form-panel {
		border-radius: 0 !important;
	}
	.autochange-btn {
		opacity: 0.55;
	}
	.autochange-btn:hover {
		opacity: 1;
	}
	.season-border-breath {}

	@keyframes wcFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.wc-fade-in {
		animation: wcFadeIn 0.5s cubic-bezier(.25,.46,.45,.94) both;
	}
`;
