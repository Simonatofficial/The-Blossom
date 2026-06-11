/* Infinite Canvas preset module (docs/08 §2): Canvas + Gallery. */

export const INFCANVAS_PRESET = {
  key: 'infinitecanvas',
  name: 'Infinite Canvas',
  icon: 'maximize',
  description: 'A boundless drawing surface — zoom from murals to margins. Exports land in the gallery.',
  pages: [
    {
      name: 'Canvas', icon: 'pen',
      widgets: [{ type: 'infcanvas', name: 'Canvas' }]
    },
    {
      name: 'Gallery', icon: 'image',
      widgets: [
        { type: 'gallery', name: 'Exports' },
        { type: 'notes', name: 'Field notes', objects: [{ kind: 'note', data: { html: '<p>Scroll or pinch to zoom (the readout shows how deep you are), drag with the pan tool, and <b>bookmark</b> viewpoints you love. The brush is world-scaled — zoom in to paint fine detail.</p>', lastOpened: null } }] }
      ]
    }
  ]
};
