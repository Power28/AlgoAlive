import type { TourStep } from '../components/Tour';

/**
 * 首次使用導覽的步驟。runExample：在「視覺化」那一步按下一步時先替使用者執行一次，
 * 下一步介紹動畫區時就有東西可看。
 */
export function appTourSteps(runExample: () => void): TourStep[] {
  return [
    { id: 'welcome', title: 'tourWelcomeTitle', body: 'tourWelcomeBody' },
    { id: 'editor', target: '[data-tour="editor"]', title: 'tourEditorTitle', body: 'tourEditorBody' },
    { id: 'call', target: '[data-tour="call"]', title: 'tourCallTitle', body: 'tourCallBody' },
    { id: 'run', target: '[data-action="visualize"]', title: 'tourRunTitle', body: 'tourRunBody', onNext: runExample },
    { id: 'viz', target: '[data-tour="viz"]', title: 'tourVizTitle', body: 'tourVizBody' },
    { id: 'controls', target: '[data-tour="controls"]', title: 'tourControlsTitle', body: 'tourControlsBody' },
    { id: 'learn', target: '[data-action="library"]', title: 'tourLearnTitle', body: 'tourLearnBody' },
    { id: 'notes', target: '[data-action="save-as-note"]', title: 'tourNotesTitle', body: 'tourNotesBody' },
  ];
}
