import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../src/defaults.js';
import { renderHtml } from '../src/render.js';

function sample() {
  const state = structuredClone(defaults);
  state.projects = Array.from({ length: 7 }, (_, i) => ({
    id: 'project-' + i, title: 'Project ' + i, published: true, featured: i === 6,
  }));
  state.projects[6].mediaIds = ['video-1'];
  state.media = [{ id: 'video-1', type: 'video/mp4', src: '/media/video-1' }];
  return state;
}

test('homepage shows five projects with featured items first and can show all', () => {
  const state = sample();
  const render = (url = '/') => renderHtml(state, 'https://example.com' + url, { name: 'home' });
  const cards = html => [...html.matchAll(/class="project-card" href="\/projects\/(project-\d)/g)].map(match => match[1]);
  assert.deepEqual(cards(render()), ['project-6', 'project-0', 'project-1', 'project-2', 'project-3']);
  state.settings.homeProjectCount = 6;
  assert.equal(cards(render()).length, 6);
  assert.equal(cards(render('/?projects=all')).length, 7);
});

test('video-only cards and project media display an early video frame', () => {
  const state = sample();
  const home = renderHtml(state, 'https://example.com/', { name: 'home' });
  const detail = renderHtml(state, 'https://example.com/projects/project-6', { name: 'project', id: 'project-6' });
  assert.match(home, /class="video-thumbnail" src="\/media\/video-1#t=0.2"/);
  assert.match(detail, /<video controls preload="auto" src="\/media\/video-1#t=0.2"/);
});
