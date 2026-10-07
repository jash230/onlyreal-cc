import { useParams } from 'react-router-dom';
import ProfileView from '../components/ProfileView.jsx';

export default function Profile() {
  const { username } = useParams();
  return <ProfileView key={username} username={username} />;
}
