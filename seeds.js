// Sample artworks for testing — run seedCollection() in the console
window.seedCollection = function () {
  const seeds = [
    {
      id: 'aic-16571',
      source: 'aic',
      title: 'A Sunday on La Grande Jatte — 1884',
      artist: 'Georges Seurat',
      date: '1884–86',
      period: 'Post-Impressionism',
      medium: 'Oil on canvas',
      imageUrl: 'https://www.artic.edu/iiif/2/1adf2696-8489-499b-cad2-821d7fde4b33/full/400,/0/default.jpg',
      description: 'Seurat spent two years on this monumental painting depicting Parisians relaxing on an island in the Seine.',
      themes: ['figures', 'water', 'light', 'urban'],
      customTags: [],
      notes: '',
      isFavorite: true,
      dateAdded: new Date().toISOString()
    },
    {
      id: 'aic-14598',
      source: 'aic',
      title: 'Water Lilies',
      artist: 'Claude Monet',
      date: '1906',
      period: 'High Impressionism',
      medium: 'Oil on canvas',
      imageUrl: 'https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/400,/0/default.jpg',
      description: 'One of Monet\'s iconic series of water lily paintings from his garden at Giverny.',
      themes: ['water', 'light', 'flowers', 'garden'],
      customTags: ['Giverny', 'series'],
      notes: 'Saw the full series at the Orangerie in Paris — breathtaking.',
      isFavorite: true,
      dateAdded: new Date().toISOString()
    },
    {
      id: 'cma-2134',
      source: 'cma',
      title: 'The Race Track (Death on a Pale Horse)',
      artist: 'Albert Pinkham Ryder',
      date: '1896–1908',
      period: 'Post-Impressionism',
      medium: 'Oil on canvas',
      imageUrl: 'https://openaccess-api.clevelandart.org/api/artworks/1928.8/images/web',
      description: 'An enigmatic and turbulent image of a skeleton riding a pale horse around a racetrack.',
      themes: ['movement', 'atmospheric', 'sky'],
      customTags: ['symbolism'],
      notes: '',
      isFavorite: false,
      dateAdded: new Date().toISOString()
    },
    {
      id: 'aic-111628',
      source: 'aic',
      title: 'In the Omnibus',
      artist: 'Mary Cassatt',
      date: '1891',
      period: 'High Impressionism',
      medium: 'Color aquatint, drypoint, and softground etching on ivory laid paper',
      imageUrl: 'https://www.artic.edu/iiif/2/6e3ce929-7a43-6a57-e878-31b2b2e9a19f/full/400,/0/default.jpg',
      description: 'Cassatt depicts two women and a child on a Paris omnibus, one of her signature domestic scenes.',
      themes: ['figures', 'urban', 'domestic'],
      customTags: ['printmaking', 'women artists'],
      notes: '',
      isFavorite: false,
      dateAdded: new Date().toISOString()
    },
    {
      id: 'aic-80607',
      source: 'aic',
      title: 'The Bedroom',
      artist: 'Vincent van Gogh',
      date: '1889',
      period: 'Post-Impressionism',
      medium: 'Oil on canvas',
      imageUrl: 'https://www.artic.edu/iiif/2/25c31d8d-21a4-9ea1-1d73-6a2eca4dda7e/full/400,/0/default.jpg',
      description: 'Van Gogh painted three versions of his bedroom at Arles; this is the third and final version.',
      themes: ['domestic', 'light'],
      customTags: [],
      notes: 'The distorted perspective gives it such energy.',
      isFavorite: true,
      dateAdded: new Date().toISOString()
    }
  ];

  const existing = JSON.parse(localStorage.getItem('impressionist-collection') || '[]');
  const existingIds = new Set(existing.map(a => `${a.source}-${a.id}`));
  const toAdd = seeds.filter(s => !existingIds.has(`${s.source}-${s.id}`));
  const merged = [...existing, ...toAdd];
  localStorage.setItem('impressionist-collection', JSON.stringify(merged));
  console.log(`Seeded ${toAdd.length} artworks. Reload the app to see them.`);
  alert(`Added ${toAdd.length} sample artworks to your collection. Reload the page to see them.`);
};
