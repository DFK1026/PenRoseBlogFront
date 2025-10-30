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
			powerPreference: 'high-performance',
		});

		appRef.current = app;
		container.querySelector('.maid-canvas-wrap').appendChild(app.view);

		let disposed = false;

		const fitAndPlace = () => {
			const model = modelRef.current;
			if (!model || !app.renderer) return;
			// 以容器高度为参考，缩放至 90%
			const baseH = model.height || 1; // 当前渲染高度（未缩放前的数值）
			const viewH = app.renderer.height || container.clientHeight || 400;
			const viewW = app.renderer.width || container.clientWidth || 300;
			// 先将 scale 重置为 1 以便计算
			const curScaleX = model.scale.x;
			const curScaleY = model.scale.y;
			model.scale.set(1, 1);
			const rawH = model.height || baseH;
			const scale = Math.max(0.1, Math.min(1.8, (viewH * 0.9) / rawH));
			model.scale.set(scale, scale);
			// 放到底部靠右
			model.x = Math.max(0, viewW - model.width - 4);
			model.y = Math.max(0, viewH - model.height);
			// 轻微过渡效果
			model.scale.set(scale, scale);
			// 还原无效变量引用（避免 eslint 提示未使用）
			void curScaleX; void curScaleY;
		};

		const loadModel = async (idx) => {
			setLoading(true);
			setError('');
			try {
				const path = MODEL_PATHS[idx % MODEL_PATHS.length];
				const model = await Live2DModel.from(path, { autoInteract: true });
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

	// 切换模型
	const handleSwitch = async () => {
		const next = (modelIndex + 1) % MODEL_PATHS.length;
		setModelIndex(next);
		const app = appRef.current;
		if (!app) return;
		try {
			const path = MODEL_PATHS[next];
			setLoading(true);
			const model = await Live2DModel.from(path, { autoInteract: true });
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
			// 重新适配
			const container = containerRef.current;
			const viewH = app.renderer.height || container.clientHeight || 400;
			const viewW = app.renderer.width || container.clientWidth || 300;
			// 重置比例求新比例
			model.scale.set(1, 1);
			const rawH = model.height || 1;
			const scale = Math.max(0.1, Math.min(1.8, (viewH * 0.9) / rawH));
			model.scale.set(scale, scale);
			model.x = Math.max(0, viewW - model.width - 4);
			model.y = Math.max(0, viewH - model.height);
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
	    {loading && <div className="maid-status">加载中…</div>}
	    {error && <div className="maid-error">{error}</div>}
	  </div>
	);
}
