import { useEffect, useState } from 'react';

/**
 * useAuthState
 * - 从 localStorage 读取登录状态与头像地址
 * - 监听 storage 与自定义 auth-changed 事件以便跨组件/页面及时刷新
 */
export function useAuthState() {
  const read = () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const avatarUrl = typeof localStorage !== 'undefined' ? (localStorage.getItem('avatarUrl') || '') : '';
    return { isLoggedIn: !!token, avatarUrl };
  };

  const [{ isLoggedIn, avatarUrl }, setState] = useState(read);

  useEffect(() => {
    const onStorage = (e) => {
      if (!e || (e.key !== null && e.key !== 'token' && e.key !== 'avatarUrl')) return;
      setState(read());
    };
    const onAuthChanged = () => setState(read());
    window.addEventListener('storage', onStorage);
    window.addEventListener('auth-changed', onAuthChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth-changed', onAuthChanged);
    };
  }, []);

  return { isLoggedIn, avatarUrl };
}
