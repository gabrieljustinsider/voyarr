import EntityListPage from './common/EntityListPage'

export default function Tags() {
  return (
    <EntityListPage
      title="Tags"
      fetchUrl="/tags"
      createUrl="/tags"
      overviewDescription="Browse all tags across your library. Click a tag to filter the library by that tag."
      emptyMessage="No tags found in your library."
      onNavigate={(name) => { window.location.hash = `#library?tags=${encodeURIComponent(name)}` }}
      onCreate={true}
      onRename={true}
      onDelete={true}
      onMerge={true}
    />
  )
}
