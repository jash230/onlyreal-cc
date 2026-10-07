import { Follow, Like, Video } from './models.js';

const idEq = (a, b) => !!a && !!b && String(a) === String(b);

export function authorDto(u, viewer, following = false) {
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    isFollowing: following,
    isMe: idEq(viewer?._id, u._id),
  };
}

export async function publicUser(u, viewer) {
  const [following, likesAgg, isFollowing] = await Promise.all([
    Follow.countDocuments({ follower: u._id }),
    Video.aggregate([{ $match: { user: u._id } }, { $group: { _id: null, n: { $sum: '$likeCount' } } }]),
    viewer && !idEq(viewer._id, u._id) ? Follow.exists({ follower: viewer._id, following: u._id }) : null,
  ]);
  return {
    ...authorDto(u, viewer, !!isFollowing),
    bio: u.bio,
    createdAt: u.createdAt,
    followers: u.followerCount,
    following,
    likes: likesAgg[0]?.n || 0,
  };
}

// Videos must have `user` populated. Batches the viewer's like/follow lookups.
export async function videoDtos(videos, viewer) {
  videos = videos.filter((v) => v.user);
  let liked = new Set();
  let following = new Set();
  if (viewer && videos.length) {
    const [likes, follows] = await Promise.all([
      Like.find({ user: viewer._id, video: { $in: videos.map((v) => v._id) } }, 'video').lean(),
      Follow.find({ follower: viewer._id, following: { $in: videos.map((v) => v.user._id) } }, 'following').lean(),
    ]);
    liked = new Set(likes.map((l) => String(l.video)));
    following = new Set(follows.map((f) => String(f.following)));
  }
  return videos.map((v) => ({
    id: String(v._id),
    url: v.url || `/uploads/${v.filename}`,
    caption: v.caption,
    views: v.views,
    createdAt: v.createdAt,
    likeCount: v.likeCount,
    commentCount: v.commentCount,
    liked: liked.has(String(v._id)),
    author: authorDto(v.user, viewer, following.has(String(v.user._id))),
  }));
}

export async function videoDto(video, viewer) {
  return (await videoDtos([video], viewer))[0];
}
