export function filterSongsNotInSetlist(songs, setItems) {
  const inSet = new Set((setItems ?? []).map((item) => item.song.id));
  return (songs ?? []).filter((song) => !inSet.has(song.id));
}

export function pruneSelectedSongIds(selectedIds, availableSongs) {
  const availableIds = new Set((availableSongs ?? []).map((song) => song.id));
  return (selectedIds ?? []).filter((songId) => availableIds.has(songId));
}

export function mergeSelectionWithSongs(selectedIds, songs) {
  const merged = new Set([...(selectedIds ?? []), ...(songs ?? []).map((song) => song.id)]);
  return Array.from(merged);
}

export function idsReadyToAdd(selectedIds, availableSongs) {
  const availableIds = new Set((availableSongs ?? []).map((song) => song.id));
  return (selectedIds ?? []).filter((songId) => availableIds.has(songId));
}
