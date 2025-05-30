import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  FlatList,
  Platform,
  Dimensions,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import {
  ArrowLeft,
  Edit3,
  MessageSquare,
  Send,
  CheckCircle,
  Users,
  HelpCircle,
} from 'lucide-react-native'
import Colors, { API_BASE_URL } from '@/constants'

import { GroupRow, QuestionRow, VoteRow, CommentRow } from '@/types/database'

const AppColors = Colors.dark

const { width } = Dimensions.get('window')

const memberItemWidth = (width - 40 - 30) / 2


interface FrontendQuestion extends QuestionRow {
  votes: VoteRow[]
  my_vote?: VoteRow | null
  vote_counts?: { [voted_for_user_id: string]: number }
}
interface FrontendGroupDetails {
  group: GroupRow;
  members: {
    userId: string
    status: string
    username?: string
    pfp_url?: string;
  }[]
  comments: CommentRow[] & { username?: string }[];
  questions: FrontendQuestion[]
}

interface FrontendCommentRow extends CommentRow {
  username?: string;
}

const editButtonIconSize = 22;
const editButtonPaddingHorizontal = 12;
const editButtonPaddingVertical = 8;
const editButtonCalculatedWidth = editButtonIconSize + (editButtonPaddingHorizontal * 2);

const GroupDetailsScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const router = useRouter()
  const { userId, isLoaded: authLoaded } = useAuth()

  const [userGroupId, setUserGroupId] = useState<string | null>(null)
  const [groupDetails, setGroupDetails] = useState<FrontendGroupDetails | null>(null)

  const [isLoadingGroupStatus, setIsLoadingGroupStatus] = useState(true)
  const [isLoadingGroupDetails, setIsLoadingGroupDetails] = useState(false)

  const [newComment, setNewComment] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [isSubmittingVote, setIsSubmittingVote] = useState<string | null>(null)
  const [hasUserCommented, setHasUserCommented] = useState(false); // NEW STATE

  const [error, setError] = useState<string | null>(null)

  const fetchGroupDetails = useCallback(async () => {
    if (!userGroupId) {
      setGroupDetails(null)
      setHasUserCommented(false); // Reset if no group
      return
    }
    setIsLoadingGroupDetails(true)
    setError(null)
    try {
      const [questionRes, groupRes, commentRes, memberRes] = await Promise.all([
        fetch(`${API_BASE_URL}/group/${userGroupId}/questions`),
        fetch(`${API_BASE_URL}/group/${userGroupId}`),
        fetch(`${API_BASE_URL}/group/${userGroupId}/comments`),
        fetch(`${API_BASE_URL}/group/${userGroupId}/members`),
      ]);

      if (!questionRes.ok) throw new Error(await questionRes.json().then(d => d.message).catch(() => `Failed to fetch questions: ${questionRes.status}`))
      const questionData: FrontendQuestion[] = await questionRes.json()

      if (!groupRes.ok) throw new Error(await groupRes.json().then(d => d.message).catch(() => `Failed to fetch group data: ${groupRes.status}`))
      const groupData: GroupRow = await groupRes.json()

      if (!commentRes.ok) throw new Error(await commentRes.json().then(d => d.message).catch(() => `Failed to fetch comments: ${commentRes.status}`))
      const commentData: CommentRow[] = await commentRes.json()

      if (!memberRes.ok) throw new Error(await memberRes.json().then(d => d.message).catch(() => `Failed to fetch members: ${memberRes.status}`))
      const memberData: { members: { userId: string; username?: string; pfp_url?: string; status: string }[]; count?: number } = await memberRes.json()

      const processedQuestions: FrontendQuestion[] = questionData.map((q) => {
        const votesArray = Array.isArray(q.votes) ? q.votes : [];
        const myVote = votesArray.find((v) => v.voter_user_id === userId)
        const voteCounts: { [voted_for_user_id: string]: number } = {}
        votesArray.forEach((v) => { voteCounts[v.voted_for_user_id] = (voteCounts[v.voted_for_user_id] || 0) + 1 })
        return { ...q, votes: votesArray, my_vote: myVote || null, vote_counts: voteCounts }
      })

      const processedComments = commentData.map(c => ({
        ...c,
        username: memberData.members.find(m => m.userId === c.user_id)?.username || (c.user_id === userId ? "You" : "A member")
      }));

      // Check if the current user has commented
      const userHasCommented = processedComments.some(comment => comment.user_id === userId);
      setHasUserCommented(userHasCommented); // Update the state

      setGroupDetails({
        group: groupData,
        members: memberData.members.filter(member => member.status === "joined"),
        comments: processedComments,
        questions: processedQuestions,
      })
    } catch (err) {
      console.error('Fetch Group Details Error:', err)
      setError(err instanceof Error ? err.message : 'Could not load group details.')
      setGroupDetails(null)
      setHasUserCommented(false); // Reset on error
    } finally {
      setIsLoadingGroupDetails(false)
    }
  }, [userGroupId, userId])

  useEffect(() => {
    const findUserGroup = async () => {
      if (!authLoaded || !userId || !partyId) {
        if (authLoaded && !userId) setError('User not authenticated.')
        if (!partyId) setError('Party context is missing.')
        setIsLoadingGroupStatus(false); return;
      }
      setIsLoadingGroupStatus(true); setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`)
        if (!response.ok) {
          if (response.status === 404) {
            setUserGroupId(null); setError('You are not currently in a group for this party.')
          } else {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Failed to find user's group status: ${response.status}`)
          }
        } else {
          const data: GroupRow & { status?: string } = await response.json()
          if (data.group_id) { setUserGroupId(data.group_id) }
          else { setUserGroupId(null); setError('You are not currently in a group for this party.') }
        }
      } catch (err) {
        console.error('Find User Group Error:', err)
        setError(err instanceof Error ? err.message : 'Could not determine your group.')
        setUserGroupId(null)
      } finally {
        setIsLoadingGroupStatus(false)
      }
    }
    findUserGroup()
  }, [authLoaded, userId, partyId])

  useEffect(() => {
    if (userGroupId) { fetchGroupDetails() }
    else {
      setGroupDetails(null);
      setHasUserCommented(false); // Reset if no group
    }
  }, [userGroupId, fetchGroupDetails])

  const handlePostComment = async () => {
    if (newComment.trim() === '' || !userGroupId || !userId || hasUserCommented) return // Added hasUserCommented check
    setIsPostingComment(true)
    try {
      const response = await fetch(`${API_BASE_URL}/group/${userGroupId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: newComment, user_id: userId }),
      })
      if (!response.ok) throw new Error(await response.json().then(d => d.message).catch(() => 'Failed to post comment.'))
      setNewComment('')
      const newCommentData: CommentRow = await response.json()
      setGroupDetails((prevDetails) => {
        if (!prevDetails) return null;
        const commenter = prevDetails.members.find(m => m.userId === newCommentData.user_id);
        const commentWithUsername: FrontendCommentRow = { ...newCommentData, username: commenter?.username || (userId === newCommentData.user_id ? 'You' : 'A member') };
        return { ...prevDetails, comments: [commentWithUsername, ...prevDetails.comments] };
      });
      setHasUserCommented(true); // User has now commented, disable future comments
    } catch (err) {
      console.error('Post Comment Error:', err)
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not post comment.')
    } finally {
      setIsPostingComment(false)
    }
  }

  const handleVote = async (questionId: string, votedForUserId: string) => {
    if (!userGroupId || !userId || isSubmittingVote) return
    setIsSubmittingVote(questionId)
    try {
      const response = await fetch(`${API_BASE_URL}/group/${userGroupId}/questions/${questionId}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voted_for_user_id: votedForUserId, voter_user_id: userId }),
      })
      if (!response.ok) throw new Error(await response.json().then(d => d.message).catch(() => 'Failed to submit vote.'))
      fetchGroupDetails()
    } catch (err) {
      console.error('Vote Error:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit vote.')
    } finally {
      setIsSubmittingVote(null)
    }
  }

  if (isLoadingGroupStatus || (!authLoaded && !userId)) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
        <Text style={styles.loaderText}>{!authLoaded ? "Authenticating..." : "Finding your group..."}</Text>
      </View>
    );
  }

  if (authLoaded && userId && !userGroupId && !isLoadingGroupStatus) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>{error || 'You are not currently in a group for this party.'}</Text>
        <TouchableOpacity onPress={() => router.replace(partyId ? `/party/${partyId}` : '/dashboard')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to Party</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (userGroupId && isLoadingGroupDetails) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
        <Text style={styles.loaderText}>Loading Group Details...</Text>
      </View>
    );
  }

  if (userGroupId && !isLoadingGroupDetails && (error || !groupDetails)) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>{error || 'Group details could not be loaded. The group might no longer exist or there was an issue.'}</Text>
        <TouchableOpacity onPress={fetchGroupDetails} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace(partyId ? `/party/${partyId}` : '/dashboard')} style={[styles.primaryButton, { backgroundColor: AppColors.inputBg, marginTop: 10 }]}>
          <Text style={styles.primaryButtonText}>Back to Party</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!groupDetails || !userGroupId) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>Unable to display group details. Please ensure you are part of an active group.</Text>
        <TouchableOpacity onPress={() => router.replace(partyId ? `/party/${partyId}` : '/dashboard')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to Party</Text>
        </TouchableOpacity>
      </View>
    );
  }


  const isCreator = userId === groupDetails.group.creator_user_id;
  // const editButtonIconSize = 22; // Already declared outside
  // const editButtonPaddingHorizontal = 12; // Already declared outside
  // const editButtonCalculatedWidth = editButtonIconSize + (editButtonPaddingHorizontal * 2); // Already declared outside

  const renderMemberItem = ({ item }: { item: FrontendGroupDetails['members'][0] }) => (
    <View style={styles.memberItem}>
      <Image
        source={{ uri: item.pfp_url || `${API_BASE_URL}/user/${item.userId}/portrait` }}
        style={styles.memberPfp}
      />
      <Text style={styles.memberUsername} numberOfLines={1}>
        {item.username || 'User...'}
      </Text>
    </View>
  )

  const renderCommentItem = ({ item }: { item: FrontendCommentRow }) => (
    <View style={styles.commentItem}>
      <Image
        source={{ uri: `${API_BASE_URL}/user/${item.user_id}/profile-picture` }}
        style={styles.commenterPfp}
      />
      <View style={styles.commentContent}>
        <Text style={styles.commenterUsername}>{item.username || 'A member'}</Text>
        <Text style={styles.commentText}>{item.comment_text}</Text>
        <Text style={styles.commentTimestamp}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
      </View>
    </View>
  )

  const renderQuestionItem = ({ item: question }: { item: FrontendQuestion }) => (
    <View style={styles.questionCard}>
      <Text style={styles.questionText}>{question.question_text}</Text>
      <View style={styles.voteOptionsContainer}>
        {groupDetails.members.map((member) => (
          <TouchableOpacity
            key={member.userId}
            style={[
              styles.voteOptionButton,
              question.my_vote?.voted_for_user_id === member.userId && styles.myVoteOption,
              (isSubmittingVote === question.question_id) && styles.disabledButton,
            ]}
            onPress={() => handleVote(question.question_id, member.userId)}
            disabled={isSubmittingVote === question.question_id || !!question.my_vote}
          >
            <Image
              source={{ uri: member.pfp_url || `${API_BASE_URL}/user/${member.userId}/profile-picture` }}
              style={styles.voteOptionPfp}
            />
            <Text style={styles.voteOptionText} numberOfLines={1}>
              {member.username || 'User...'}
            </Text>
            {question.my_vote?.voted_for_user_id === member.userId && (
              <CheckCircle size={18} color={AppColors.yellow400} style={styles.myVoteIcon} />
            )}
            <Text style={styles.voteCountText}>
              {question.vote_counts?.[member.userId] || 0}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {isSubmittingVote === question.question_id && (
        <ActivityIndicator size="small" color={AppColors.primary} style={{ marginTop: 8 }} />
      )}
    </View>
  )

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={AppColors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {`Group by ${groupDetails.group.creator_username || 'Creator'}`}
        </Text>
        {isCreator ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(partyId && userGroupId ? `/party/${partyId}/groups/edit?groupId=${userGroupId}` : '/dashboard')}
          >
            <Edit3 size={editButtonIconSize} color={AppColors.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: editButtonCalculatedWidth }} />
        )}
      </View>


      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Users size={20} color={AppColors.primary} />
          <Text style={styles.sectionTitle}>
            Group Members ({groupDetails.members.length})
          </Text>
        </View>
        {groupDetails.members.length > 0 ? (
          <FlatList
            data={groupDetails.members}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item.userId}
            numColumns={2}
            columnWrapperStyle={styles.membersRow}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyStateText}>No members have joined yet.</Text>
        )}
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MessageSquare size={20} color={AppColors.primary} />
          <Text style={styles.sectionTitle}>Comments</Text> {/* Changed title to reflect section content */}
        </View>
        <FlatList
          data={[...groupDetails.comments]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

          }
          renderItem={renderCommentItem}
          keyExtractor={(item) => item.comment_id}
          style={styles.commentsList}
          ListEmptyComponent={
            <Text style={styles.emptyStateText}>No comments yet.</Text>
          }
          scrollEnabled={false}
        />
        {hasUserCommented ? (
          <View style={styles.commentInputContainer}>
            <Text style={styles.alreadyCommentedText}>You have already added a comment to this group.</Text>
          </View>
        ) : (
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor={AppColors.textGray}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              editable={!isPostingComment && !hasUserCommented} // Ensure editable is false if user has commented
            />
            <TouchableOpacity
              style={[
                styles.postCommentButton,
                (isPostingComment || newComment.trim() === '' || hasUserCommented) && styles.disabledButton, // Disable if user has commented
              ]}
              onPress={handlePostComment}
              disabled={isPostingComment || newComment.trim() === '' || hasUserCommented} // Disable if user has commented
            >
              {isPostingComment ? (
                <ActivityIndicator size="small" color={AppColors.white} />
              ) : (
                <Send size={20} color={AppColors.white} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {groupDetails.questions && groupDetails.questions.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <HelpCircle size={20} color={AppColors.primary} />
            <Text style={styles.sectionTitle}>Most Likely To...</Text>
          </View>
          <FlatList
            data={[...groupDetails.questions].sort(
              (a, b) => (a.order_index || 0) - (b.order_index || 0),
            )}
            renderItem={renderQuestionItem}
            keyExtractor={(item) => item.question_id}
            scrollEnabled={false}
          />
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    padding: 20,
  },
  loaderText: {
    color: AppColors.white,
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: AppColors.red400,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
    minWidth: width * 0.6,
    alignSelf: 'center',
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? 35 : 50,
    backgroundColor: AppColors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.inputBg,
  },
  backButton: {
    padding: 8,
    marginRight: 5,
    zIndex: 1,
  },
  headerTitle: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
    marginHorizontal: 5,
  },
  editButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: editButtonPaddingHorizontal,
    paddingVertical: editButtonPaddingVertical,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
    minWidth: editButtonCalculatedWidth,
    height: editButtonIconSize + (editButtonPaddingVertical * 2),
  },
  establishedStatusContainer: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: AppColors.tertiaryBg || AppColors.inputBg,
    alignItems: 'center',
    marginVertical: 10,
    marginHorizontal: 15,
    borderRadius: 8,
  },
  establishedStatusText: {
    color: AppColors.gray200,
    fontSize: 14,
    fontWeight: '500',
  },
  sectionContainer: {
    marginTop: 20,
    marginHorizontal: 15,
    padding: 15,
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.inputBg,
  },
  sectionTitle: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  membersRow: {
    justifyContent: 'space-between',
  },
  memberItem: {
    width: memberItemWidth,
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },

  memberPfp: {
    width: memberItemWidth * 0.7, // Made bigger, adjusted from 0.55
    aspectRatio: 4 / 3, // New ratio: 4:3
    borderRadius: 8, // Adjust border radius for a rectangular shape with slight rounding
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    backgroundColor: AppColors.inputBg,
    resizeMode: 'cover', // Ensures the image covers the area, cropping if necessary
  },
  memberUsername: {
    color: AppColors.gray300,
    fontSize: 13,
    textAlign: 'center',
  },
  commentsList: {
    marginBottom: 10,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.inputBg,
  },
  commenterPfp: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    backgroundColor: AppColors.inputBg,
  },
  commentContent: {
    flex: 1,
  },
  commenterUsername: {
    color: AppColors.white,
    fontWeight: 'bold',
    fontSize: 14.5,
  },
  commentText: {
    color: AppColors.gray200,
    fontSize: 14,
    marginTop: 3,
    lineHeight: 19,
  },
  commentTimestamp: {
    color: AppColors.textGray,
    fontSize: 11,
    marginTop: 5,
    textAlign: 'right',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AppColors.inputBg,
  },
  commentInput: {
    flex: 1,
    backgroundColor: AppColors.inputBg,
    color: AppColors.white,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 22,
    fontSize: 15,
    marginRight: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: AppColors.inputBg,
  },
  postCommentButton: {
    backgroundColor: AppColors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: AppColors.inputBg,
  },
  questionText: {
    color: AppColors.white,
    fontSize: 16.5,
    fontWeight: '500',
    marginBottom: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  voteOptionsContainer: {

  },
  voteOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.inputBg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 48,
  },
  myVoteOption: {
    borderColor: AppColors.yellow400,
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
  },
  voteOptionPfp: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: AppColors.gray500,
  },
  voteOptionText: {
    color: AppColors.gray100,
    fontSize: 14.5,
    flex: 1,
  },
  myVoteIcon: {
    marginLeft: 8,
  },
  voteCountText: {
    color: AppColors.gray300,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 'auto',
    paddingLeft: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyStateText: {
    color: AppColors.textGray,
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 14.5,
    fontStyle: 'italic',
    paddingHorizontal: 10,
  },
  alreadyCommentedText: { // NEW STYLE
    flex: 1,
    color: AppColors.textGray,
    textAlign: 'center',
    fontSize: 14.5,
    paddingVertical: 10,
  },
})

export default GroupDetailsScreen