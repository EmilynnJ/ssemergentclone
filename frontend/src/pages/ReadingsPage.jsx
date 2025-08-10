import React from 'react';
import ReaderList from './ReaderList';

/**
 * ReadingsPage
 *
 * Presents a searchable list of readers for clients to browse and
 * request on‑demand sessions. Users can filter by call type or price
 * range (future extension). The ReaderList component encapsulates
 * the functionality to start a session and navigate to the call page.
 */
const ReadingsPage = () => {
  return (
    <div className="p-6">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Find a Reader</h2>
      {/* ReaderList fetches and displays readers */}
      <ReaderList />
    </div>
  );
};

export default ReadingsPage;