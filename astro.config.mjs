// @ts-check
import { defineConfig } from 'astro/config';

/**
 * GitHub Pages 배포용 베이스 경로.
 * 루트 배포(claudianus.github.io)는 기본값 '/' 그대로 사용.
 * 프로젝트 페이지(저장소 하위 경로) 배포 시 ASTRO_BASE=/repo-name 으로 덮어쓴다.
 */
const base = process.env.ASTRO_BASE ?? '/';

export default defineConfig({
  site: 'https://claudianus.github.io',
  base,
  trailingSlash: 'always',
});
