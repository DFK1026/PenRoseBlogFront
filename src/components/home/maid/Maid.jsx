import React, { useEffect, useRef, useState } from 'react';
import { Application, Ticker } from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import '../../../styles/home/maidstyle/Maid.css';

// 将 Pixi 的 Ticker 注册给 Live2D，让 Live2D 的更新与 Pixi 的主循环同步
/*Pixi 的 Ticker 是一个基于 requestAnimationFrame 的“主循环驱动器”；
把 Live2D 绑定到这个驱动器上，
就能让模型的动画更新和场景渲染在同一帧节奏里运行，
保持一致的帧率、暂停/继续一致、性能也更可控
*/
Live2DModel.registerTicker(Ticker);

//模型路径
const MODEL_PATHS = [
	'/live2dmodels/樱花狐/Bhuxian/Bhuxian.model3.json',
	'/live2dmodels/applefox/A苹果小狐狸/A苹果小狐狸.model3.json',
];

export default function Maid() {
	const containerRef = useRef(null);
	const appRef = useRef(null);
	const modelRef = useRef(null);


		const [modelIndex, setModelIndex] = useState(0);
		const [loading, setLoading] = useState(true);
		const [error, setError] = useState('');
		// 用户可调的清晰度（渲染分辨率倍率）。默认取设备像素比，最高 2x 以兼顾性能
		const [dpi, setDpi] = useState(() => Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)));
		// 用户可调的模型大小倍率（在 contain 结果基础上再缩放，不会超过容器）
		const [userScale, setUserScale] = useState(1);

	// 拖拽相关
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let dragging = false;
		let startX = 0;
		let startY = 0;
		let startLeft = 0;
		let startTop = 0;

		const onPointerDown = (e) => {
			// 如果点击在控件区域内（清晰度选择器），则不触发拖拽
			if (e.target && typeof e.target.closest === 'function') {
				const inControls = e.target.closest('.maid-controls');
				if (inControls) return;
			}
			dragging = true;
			const rect = el.getBoundingClientRect();
			startLeft = rect.left;
			startTop = rect.top;
			startX = e.clientX;
			startY = e.clientY;
			el.classList.add('maid-dragging');
		};

		const onPointerMove = (e) => {
			if (!dragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
			const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
			el.style.left = `${newLeft}px`;
			el.style.top = `${newTop}px`;
			el.style.right = 'auto';
			el.style.bottom = 'auto';
		};

		const onPointerUp = () => {
			dragging = false;
			el.classList.remove('maid-dragging');
		};

		el.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);

		return () => {
			el.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};
	}, []);

	// 初始化 Pixi 与加载模型
	useEffect(() => {
			// 运行时保障：确保 Cubism4 Core 已加载
			if (typeof window !== 'undefined' && !window.Live2DCubismCore) {
				setError('缺少 Cubism4 Core：请将 live2dcubismcore.min.js 放到 public/live2dsrc/ 并在 index.html 中通过 <script src="/live2dsrc/live2dcubismcore.min.js"></script> 引入');
				setLoading(false);
				return;
			}

		const container = containerRef.current;
		if (!container) return;


		const app = new Application({
			resizeTo: container,
			backgroundAlpha: 0,
			antialias: true,
			// 让画布以高分屏分辨率渲染，显著提高清晰度
			autoDensity: true,
			resolution: dpi,
			// 避免亚像素渲染导致的轻微发糊
			roundPixels: true,
			powerPreference: 'high-performance',
		});

		appRef.current = app;
		container.querySelector('.maid-canvas-wrap').appendChild(app.view);

		let disposed = false;

		const fitAndPlace = () => {
			const model = modelRef.current;
			if (!model || !app.renderer) return;
			// 同时按宽高做等比缩放（contain），保证模型完整显示
			const viewW = (app.renderer.screen && app.renderer.screen.width) || container.clientWidth || 300;
			const viewH = (app.renderer.screen && app.renderer.screen.height) || container.clientHeight || 400;
			const margin = 0.94; // 预留边距，防止紧贴边缘
			// 重置比例以获取原始大小
			model.scale.set(1, 1);
			const rawW = Math.max(1, model.width);
			const rawH = Math.max(1, model.height);
			const scaleByW = (viewW * margin) / rawW;
			const scaleByH = (viewH * margin) / rawH;
			const baseScale = Math.min(scaleByW, scaleByH);
			const desired = baseScale * (Number(userScale) || 1);
			const finalScale = Math.max(0.05, Math.min(baseScale, desired));
			model.scale.set(finalScale, finalScale);
			// 以右下角为锚点对齐（优先使用 anchor）
			if (model.anchor && typeof model.anchor.set === 'function') {
				model.anchor.set(1, 1);
				model.x = viewW - 4; // 右侧留 4px 边距
				model.y = viewH;    // 贴底
			} else {
				// 无 anchor 回退：按尺寸计算右下角
				model.x = Math.max(0, viewW - model.width - 4);
				model.y = Math.max(0, viewH - model.height);
			}
		};

		const loadModel = async (idx) => {
			setLoading(true);
			setError('');
			try {
				const path = MODEL_PATHS[idx % MODEL_PATHS.length];
				const model = await Live2DModel.from(path, { autoInteract: false });
				if (disposed) return;
				if (modelRef.current) {
					try {
						app.stage.removeChild(modelRef.current);
						modelRef.current.destroy();
					} catch (err) {
						console.warn('旧模型销毁失败', err);
					}
				}
				modelRef.current = model;
				model.interactive = true;
				// 右下角锚点，便于对齐
				if (model.anchor && typeof model.anchor.set === 'function') {
					model.anchor.set(1, 1);
				}
				model.on('pointertap', () => {
					// 轻微缩放动画，模拟反馈
					const s = model.scale.x;
					model.scale.set(s * 0.98);
					setTimeout(() => model.scale.set(s), 130);
				});
				app.stage.addChild(model);
				fitAndPlace();
			} catch (e) {
				console.error(e);
				setError('模型加载失败，请稍后重试');
			} finally {
				setLoading(false);
			}
		};

		loadModel(modelIndex);

		const onResize = () => fitAndPlace();
		window.addEventListener('resize', onResize);

		return () => {
			disposed = true;
			window.removeEventListener('resize', onResize);
			try {
					if (modelRef.current) {
						app.stage.removeChild(modelRef.current);
						modelRef.current.destroy(true);
					}
				} catch (err) {
					console.warn('卸载时销毁模型失败', err);
				}
				try {
					app.destroy(true, { children: true, texture: true, baseTexture: true });
				} catch (err) {
					console.warn('卸载时销毁应用失败', err);
				}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 清晰度（渲染分辨率）动态调整
	useEffect(() => {
		const app = appRef.current;
		const container = containerRef.current;
		if (!app || !container || !app.renderer) return;
		const r = Math.max(1, Math.min(3, Number(dpi) || 1));
		try {
			if (app.renderer.resolution !== r) {
				app.renderer.resolution = r;
				// 触发内部缓冲区重建，保持 CSS 尺寸不变
				app.renderer.resize(container.clientWidth, container.clientHeight);
			}
		} catch (e) {
			console.warn('调整清晰度失败', e);
		}
	}, [dpi]);

	// 大小倍率调整时，按当前容器尺寸重新适配
	useEffect(() => {
		const app = appRef.current;
		const container = containerRef.current;
		const model = modelRef.current;
		if (!app || !container || !model) return;
		try {
			const viewW = (app.renderer.screen && app.renderer.screen.width) || container.clientWidth || 300;
			const viewH = (app.renderer.screen && app.renderer.screen.height) || container.clientHeight || 400;
			const margin = 0.94;
			model.scale.set(1, 1);
			const rawW = Math.max(1, model.width);
			const rawH = Math.max(1, model.height);
			const scaleByW = (viewW * margin) / rawW;
			const scaleByH = (viewH * margin) / rawH;
			const baseScale = Math.min(scaleByW, scaleByH);
			const desired = baseScale * (Number(userScale) || 1);
			const finalScale = Math.max(0.05, Math.min(baseScale, desired));
			model.scale.set(finalScale, finalScale);
			if (model.anchor && typeof model.anchor.set === 'function') {
				model.anchor.set(1, 1);
				model.x = viewW - 4;
				model.y = viewH;
			} else {
				model.x = Math.max(0, viewW - model.width - 4);
				model.y = Math.max(0, viewH - model.height);
			}
		} catch (e) {
			console.warn('根据大小倍率适配失败', e);
		}
	}, [userScale]);

	// 切换模型
	const handleSwitch = async () => {
		const next = (modelIndex + 1) % MODEL_PATHS.length;
		setModelIndex(next);
		const app = appRef.current;
		if (!app) return;
		try {
			const path = MODEL_PATHS[next];
			setLoading(true);
			const model = await Live2DModel.from(path, { autoInteract: false });
			if (modelRef.current) {
				try {
					app.stage.removeChild(modelRef.current);
					modelRef.current.destroy();
				} catch (err) {
					console.warn('切换时销毁旧模型失败', err);
				}
			}
			modelRef.current = model;
			model.interactive = true;
			model.on('pointertap', () => {
				const s = model.scale.x;
				model.scale.set(s * 0.98);
				setTimeout(() => model.scale.set(s), 130);
			});
			app.stage.addChild(model);
			// 重新适配：按宽高 contain 缩放 + 用户倍率，右下对齐
			const container = containerRef.current;
			const viewW = (app.renderer.screen && app.renderer.screen.width) || container.clientWidth || 300;
			const viewH = (app.renderer.screen && app.renderer.screen.height) || container.clientHeight || 400;
			const margin = 0.94;
			model.scale.set(1, 1);
			const rawW = Math.max(1, model.width);
			const rawH = Math.max(1, model.height);
			const scaleByW = (viewW * margin) / rawW;
			const scaleByH = (viewH * margin) / rawH;
			const baseScale = Math.min(scaleByW, scaleByH);
			const desired = baseScale * (Number(userScale) || 1);
			const finalScale = Math.max(0.05, Math.min(baseScale, desired));
			model.scale.set(finalScale, finalScale);
			if (model.anchor && typeof model.anchor.set === 'function') {
				model.anchor.set(1, 1);
				model.x = viewW - 4;
				model.y = viewH;
			} else {
				model.x = Math.max(0, viewW - model.width - 4);
				model.y = Math.max(0, viewH - model.height);
			}
		} catch (e) {
			console.error(e);
			setError('模型切换失败');
		} finally {
			setLoading(false);
		}
	};

	return (
	  <div
	    ref={containerRef}
	    className="maid-widget maid-float"
	    style={{ right: 20, bottom: 20 }}
	    onDoubleClick={handleSwitch}
	    title="可拖拽；双击切换模型"
	  >
	    <div className="maid-canvas-wrap" />
			{/* 清晰度控制：阻止事件冒泡，避免触发拖拽 */}
			<div
				className="maid-controls"
				onPointerDown={(e) => e.stopPropagation()}
				onPointerUp={(e) => e.stopPropagation()}
				onClick={(e) => e.stopPropagation()}
			>
				<label className="maid-controls-label" htmlFor="maidDpi">清晰度</label>
				<select
					id="maidDpi"
					className="maid-select"
					value={String(dpi)}
					onChange={(e) => setDpi(parseFloat(e.target.value))}
					title="调整渲染分辨率，数值越大越清晰但越耗性能"
				>
					<option value="1">1x</option>
					<option value="1.5">1.5x</option>
					<option value="2">2x</option>
					<option value="3">3x</option>
				</select>
				<label className="maid-controls-label" htmlFor="maidScale">大小</label>
				<input
					id="maidScale"
					className="maid-range"
					type="range"
					min="0.5"
					max="1.2"
					step="0.05"
					value={userScale}
					onChange={(e) => setUserScale(parseFloat(e.target.value))}
					title="按比例缩小/放大模型（不超过容器）"
				/>
			</div>
	    {loading && <div className="maid-status">加载中…</div>}
	    {error && <div className="maid-error">{error}</div>}
	  </div>
	);
}
