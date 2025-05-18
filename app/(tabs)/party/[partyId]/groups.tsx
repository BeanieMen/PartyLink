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
  group: GroupRow
  members: {
    userId: string
    username?: string
  }[]
  comments: CommentRow[]
  questions: FrontendQuestion[]
}

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

  const [error, setError] = useState<string | null>(null)

  const fetchGroupDetails = useCallback(async () => {
    if (!userGroupId) {
      setGroupDetails(null)
      return
    }

    setIsLoadingGroupDetails(true)
    setError(null)

    try {
      const questionRes = await fetch(`${API_BASE_URL}/group/${userGroupId}/questions`)
      if (!questionRes.ok) {
        const errorData = await questionRes.json()
        throw new Error(errorData.message || `Failed to fetch group details: ${questionRes.status}`)
      }
      const questionData: FrontendQuestion[] = await questionRes.json()

      const groupRes = await fetch(`${API_BASE_URL}/group/${userGroupId}`)
      if (!groupRes.ok) {
        const errorData = await groupRes.json()
        throw new Error(errorData.message || `Failed to fetch group details: ${groupRes.status}`)
      }
      const groupData: GroupRow = await groupRes.json()

      const commentRes = await fetch(`${API_BASE_URL}/group/${userGroupId}/comments`)
      if (!commentRes.ok) {
        const errorData = await commentRes.json()
        throw new Error(errorData.message || `Failed to fetch group details: ${commentRes.status}`)
      }
      const commentData: CommentRow[] = await commentRes.json()

      const memberRes = await fetch(`${API_BASE_URL}/group/${userGroupId}/members`)
      if (!memberRes.ok) {
        const errorData = await memberRes.json()
        throw new Error(errorData.message || `Failed to fetch group details: ${memberRes.status}`)
      }
      const memberData: { members: { userId: string; username?: string }[]; count?: number } =
        await memberRes.json()

      const processedQuestions: FrontendQuestion[] = questionData.map((q) => {
        const myVote = q.votes.find((v) => v.voter_user_id === userId)
        const voteCounts: { [voted_for_user_id: string]: number } = {}
        q.votes.forEach((v) => {
          voteCounts[v.voted_for_user_id] = (voteCounts[v.voted_for_user_id] || 0) + 1
        })
        return { ...q, my_vote: myVote || null, vote_counts: voteCounts }
      })

      setGroupDetails({
        group: groupData,
        members: memberData.members,
        comments: commentData,
        questions: processedQuestions,
      })
    } catch (err) {
      console.error('Fetch Group Details Error:', err)
      setError(err instanceof Error ? err.message : 'Could not load group details.')
      setGroupDetails(null)
    } finally {
      setIsLoadingGroupDetails(false)
    }
  }, [userGroupId, userId, setIsLoadingGroupDetails, setError, setGroupDetails]) // Add all external dependencies

  useEffect(() => {
    const findUserGroup = async () => {
      if (!authLoaded || !userId || !partyId) {
        if (authLoaded && !userId) setError('User not authenticated.')
        if (!partyId) setError('Party context is missing.')
        setIsLoadingGroupStatus(false)
        return
      }
      setIsLoadingGroupStatus(true)
      setError(null)

      try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(
            errorData.message || `Failed to find user's group status: ${response.status}`,
          )
        }

        const data: GroupRow & { status: string } = await response.json()

        if (data.group_id && data.status === 'joined') {
          setUserGroupId(data.group_id)
          setIsLoadingGroupDetails(false)
        } else {
          setUserGroupId(null)
          setError('You are not currently in a group for this party.')
          setIsLoadingGroupDetails(false)
        }
      } catch (err) {
        console.error('Find User Group Error:', err)
        setError(err instanceof Error ? err.message : 'Could not determine your group.')
        setUserGroupId(null)
        setIsLoadingGroupDetails(false)
      } finally {
        setIsLoadingGroupStatus(false)
      }
    }

    findUserGroup()
  }, [authLoaded, userId, partyId])

  useEffect(() => {
    fetchGroupDetails()
  }, [userGroupId, userId, fetchGroupDetails])

  const handlePostComment = async () => {
    if (newComment.trim() === '' || !userGroupId || !userId) return
    setIsPostingComment(true)
    try {
      const response = await fetch(`${API_BASE_URL}/group/${userGroupId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: newComment, user_id: userId }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to post comment.')
      }
      setNewComment('')
      const newCommentData: CommentRow = await response.json()

      if (groupDetails) {
        setGroupDetails((prevDetails) => {
          if (!prevDetails) return null
          const updatedComments = [newCommentData, ...prevDetails.comments]
          return { ...prevDetails, comments: updatedComments }
        })
      }
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
      const response = await fetch(
        `${API_BASE_URL}/group/${userGroupId}/questions/${questionId}/vote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voted_for_user_id: votedForUserId, voter_user_id: userId }),
        },
      )
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to submit vote.')
      }
      fetchGroupDetails()
    } catch (err) {
      console.error('Vote Error:', err)
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit vote.')
    } finally {
      setIsSubmittingVote(null)
    }
  }

  if (isLoadingGroupStatus || (userGroupId && isLoadingGroupDetails)) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
        <Text style={styles.loaderText}>
          {isLoadingGroupStatus ? 'Finding your group...' : 'Loading Group Details...'}
        </Text>
      </View>
    )
  }

  if (error && !userGroupId) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!groupDetails) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>Could not load group details after finding your group.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isCreator = userId === groupDetails.group.creator_user_id

  const renderMemberItem = ({ item }: { item: { userId: string; username?: string } }) => (
    <View style={styles.memberItem}>
      <Image
        source={{ uri: `${API_BASE_URL}/user/${item.userId}/profile-picture` }}
        style={styles.memberPfp}
      />
      <Text style={styles.memberUsername} numberOfLines={1}>
        {item.username}
      </Text>
    </View>
  )

  const renderCommentItem = ({ item }: { item: CommentRow & { username?: string } }) => (
    <View style={styles.commentItem}>
      <Image
        source={{ uri: `${API_BASE_URL}/user/${item.user_id}/profile-picture` }}
        style={styles.commenterPfp}
      />
      <View style={styles.commentContent}>
        <Text style={styles.commenterUsername}>{item.username}</Text>
        <Text style={styles.commentText}>{item.comment_text}</Text>
        <Text style={styles.commentTimestamp}>{new Date(item.created_at).toLocaleString()}</Text>
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
              isSubmittingVote === question.question_id && styles.disabledButton,
            ]}
            onPress={() => handleVote(question.question_id, member.userId)}
            disabled={isSubmittingVote === question.question_id}
          >
            <Image
              source={{ uri: `${API_BASE_URL}/user/${member.userId}/profile-picture` }}
              style={styles.voteOptionPfp}
            />
            <Text style={styles.voteOptionText} numberOfLines={1}>
              {member.username}
            </Text>
            {question.my_vote?.voted_for_user_id === member.userId && (
              <CheckCircle size={16} color={AppColors.yellow400} style={styles.myVoteIcon} />
            )}
            <Text style={styles.voteCountText}>
              Votes: {question.vote_counts?.[member.userId] || 0}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {isSubmittingVote === question.question_id && (
        <ActivityIndicator size="small" color={AppColors.primary} style={{ marginTop: 5 }} />
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
        <Text style={styles.headerTitle}>{`Group by ${groupDetails.group.creator_username}`}</Text>
        {isCreator ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              router.push({
                pathname: '/party/[partyId]/groups/edit',
                params: { partyId: partyId },
              })
            }
          >
            <Edit3 size={22} color={AppColors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Users size={20} color={AppColors.primary} />
          <Text style={styles.sectionTitle}>
            Group Members ({groupDetails.members.length}/{groupDetails.group.max_members})
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
          <Text style={styles.sectionTitle}>Group Chat</Text>
        </View>
        <FlatList
          data={[...groupDetails.comments]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((comment) => {
              return {
                ...comment,
                username: groupDetails.members.find((member) => member.userId === comment.user_id)
                  ?.username,
              }
            })}
          renderItem={renderCommentItem}
          keyExtractor={(item) => item.comment_id}
          style={styles.commentsList}
          ListEmptyComponent={
            <Text style={styles.emptyStateText}>No comments yet. Start the conversation!</Text>
          }
          scrollEnabled={false}
        />
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a comment..."
            placeholderTextColor={AppColors.textGray}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.postCommentButton,
              (isPostingComment || newComment.trim() === '') && styles.disabledButton,
            ]}
            onPress={handlePostComment}
            disabled={isPostingComment || newComment.trim() === ''}
          >
            {isPostingComment ? (
              <ActivityIndicator size="small" color={AppColors.white} />
            ) : (
              <Send size={20} color={AppColors.white} />
            )}
          </TouchableOpacity>
        </View>
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
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
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
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: AppColors.white,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  editButton: {
    padding: 5,
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
  },
  sectionTitle: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  membersRow: {
    justifyContent: 'space-between',
  },
  memberItem: {
    width: memberItemWidth,
    alignItems: 'center',
    marginBottom: 15,
    padding: 5,
  },
  memberPfp: {
    width: memberItemWidth * 0.6,
    height: memberItemWidth * 0.6,
    borderRadius: (memberItemWidth * 0.6) / 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  memberUsername: {
    color: AppColors.gray300,
    fontSize: 13,
    textAlign: 'center',
  },
  commentsList: {
    maxHeight: 300,
    marginBottom: 10,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.inputBg,
  },
  commenterPfp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commenterUsername: {
    color: AppColors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  commentText: {
    color: AppColors.gray300,
    fontSize: 14,
    marginTop: 2,
  },
  commentTimestamp: {
    color: AppColors.textGray,
    fontSize: 10,
    marginTop: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 15,
    marginRight: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  postCommentButton: {
    backgroundColor: AppColors.primary,
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  questionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  questionText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  voteOptionsContainer: {},
  voteOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.inputBg,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  myVoteOption: {
    borderColor: AppColors.yellow400,
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
  },
  voteOptionPfp: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  voteOptionText: {
    color: AppColors.gray300,
    fontSize: 14,
    flex: 1,
  },
  myVoteIcon: {
    marginLeft: 5,
  },
  voteCountText: {
    color: AppColors.textGray,
    fontSize: 12,
    marginLeft: 'auto',
    paddingLeft: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyStateText: {
    color: AppColors.textGray,
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 14,
    fontStyle: 'italic',
  },
})

export default GroupDetailsScreen
