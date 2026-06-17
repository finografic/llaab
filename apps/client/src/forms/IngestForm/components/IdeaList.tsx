import styles from 'components/RunPipelineCard/RunPipelineCard.module.css';
import { Link } from 'react-router-dom';

export function IdeaList({ ideas }: { ideas: Array<{ id: string; title: string }> }) {
  if (ideas.length === 0) return null;

  return (
    <ul className={styles.itemList}>
      {ideas.map((idea) => (
        <li key={idea.id}>
          <Link to={`/vault/nodes/${idea.id}`} className={styles.itemLink}>
            {idea.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
