import { Link } from 'react-router-dom';

export function IdeaList({ ideas }: { ideas: Array<{ id: string; title: string }> }) {
  if (ideas.length === 0) return null;

  return (
    <ul className="pipeline-card__item-list">
      {ideas.map((idea) => (
        <li key={idea.id}>
          <Link to={`/vault/nodes/${idea.id}`} className="pipeline-card__link">
            {idea.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
