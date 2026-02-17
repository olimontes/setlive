import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterSongsNotInSetlist,
  idsReadyToAdd,
  mergeSelectionWithSongs,
  pruneSelectedSongIds,
} from './songSelection.js';

test('filterSongsNotInSetlist removes songs already present in set', () => {
  const songs = [
    { id: 1, title: 'A' },
    { id: 2, title: 'B' },
    { id: 3, title: 'C' },
  ];
  const setItems = [{ id: 10, song: { id: 2, title: 'B' } }];

  const result = filterSongsNotInSetlist(songs, setItems);
  assert.deepEqual(
    result.map((song) => song.id),
    [1, 3]
  );
});

test('pruneSelectedSongIds keeps only songs visible on current page', () => {
  const selected = [1, 2, 3];
  const availableSongs = [{ id: 2 }, { id: 3 }, { id: 4 }];

  const result = pruneSelectedSongIds(selected, availableSongs);
  assert.deepEqual(result, [2, 3]);
});

test('mergeSelectionWithSongs merges selection without duplicates', () => {
  const selected = [1, 2];
  const songs = [{ id: 2 }, { id: 3 }];

  const result = mergeSelectionWithSongs(selected, songs);
  assert.deepEqual(result.sort((a, b) => a - b), [1, 2, 3]);
});

test('idsReadyToAdd returns selected ids that are currently addable', () => {
  const selected = [1, 5, 9];
  const availableSongs = [{ id: 1 }, { id: 3 }, { id: 9 }];

  const result = idsReadyToAdd(selected, availableSongs);
  assert.deepEqual(result, [1, 9]);
});
