import EntityListPage from './common/EntityListPage'

export default function Performers() {
  return (
    <EntityListPage
      title="Performers"
      fetchUrl="/performers"
      createUrl="/performers"
      overviewDescription="Browse all performers across your library. Click a performer to filter the library by that name."
      emptyMessage="No performers found in your library."
      onNavigate={(name) => { window.location.hash = `#library?performers=${encodeURIComponent(name)}` }}
      onCreate={true}
      onRename={true}
      onDelete={true}
      onMerge={true}
    />
  )
}
