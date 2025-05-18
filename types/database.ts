export interface UserRow {
  user_id: string
  username: string
  pfp_url: string | null
  description: string | null
  instagram_link: string | null
  is_private: number
  created_at: string
  updated_at: string
}

export interface FriendshipRow {
  friendship_id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined' | 'blocked'
  created_at: string
  updated_at: string
}

export interface PartyRow {
  party_id: string
  name: string
  party_date: string
  party_time: string
  location: string
  image_url: string | null
  description: string | null
  creator_user_id: string | null
  created_at: string
  updated_at: string
  total_tickets: number
  tickets_sold: number // Calculated
  tickets_left: number // Calculated
}

export interface TicketRow {
  ticket_id: string
  user_id: string
  party_id: string
  qr_code_data: string
  is_scanned: number // 0 or 1
  scanned_at: string | null
  created_at: string
}

export interface GroupRow {
  group_id: string
  party_id: string
  creator_user_id: string
  creator_username: string
  max_members: number
  created_at: string
  updated_at: string
}

export interface GroupMemberRow {
  group_member_id: string
  group_id: string
  user_id: string
  status: 'invited' | 'requested' | 'joined' | 'declined_invite' | 'rejected_request' | 'left'
  joined_at: string | null
  created_at: string
  updated_at: string
}

export interface QuestionRow {
  question_id: string
  group_id: string
  question_text: string
  order_index: number | null
  created_at: string
}

export interface VoteRow {
  vote_id: string
  question_id: string
  group_id: string
  voter_user_id: string
  voted_for_user_id: string
  created_at: string
}

export interface CommentRow {
  comment_id: string
  group_id: string
  user_id: string
  comment_text: string
  created_at: string
  updated_at: string
}

export interface ChatRequestRow {
  chat_request_id: string
  requester_user_id: string
  receiver_user_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  updated_at: string
}

export interface ChatSessionRow {
  chat_session_id: string
  user1_id: string
  user2_id: string
  created_at: string
  updated_at: string
}

export interface MessageRow {
  message_id: string
  chat_session_id: string
  sender_user_id: string
  content: string
  is_read: number
  read_at: string | null
  created_at: string
}

export interface GroupChatRow {
  group_chat_id: string
  group1_id: string
  group2_id: string
  created_at: string
  updated_at: string
}

export interface GroupMessageRow {
  message_id: string
  group_chat_id: string
  sender_user_id: string
  content: string
  is_read: number
  read_at: string | null
  created_at: string
}

export interface GroupDislikeRow {
  dislike_id: string;
  user_id: string;
  group_id: string;
  created_at: string;
}