import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, AlertCircle as LucideAlertCircle, Info, Users, HelpCircle, MessageSquare } from 'lucide-react-native';
import Colors, { API_BASE_URL } from '@/constants';
import { LinearGradient } from 'expo-linear-gradient';
import { GroupRow, UserRow, QuestionRow, VoteRow, CommentRow as OriginalCommentRow } from '@/types/database';

const AppColors = Colors.dark;
const { width: screenWidth } = Dimensions.get('window');

const placeholderImage = (width: number, height: number, text: string = "?"): string => {
  const bgColor = AppColors.cardBg?.replace("#", "") || "333333";
  const txtColor = AppColors.white?.replace("#", "") || "FFFFFF";
  const initial = text ? text.substring(0, 1).toUpperCase() : '?';
  return `https://placehold.co/${width}x${height}/${bgColor}/${txtColor}?text=${encodeURIComponent(initial)}&font=Inter`;
};

interface GroupMember {
  userId: string;
  username?: string;
  status: string;
}

interface BrowsableGroupApiResponse extends GroupRow {
  creator_username: UserRow['username'];
}

export interface FrontendQuestion extends QuestionRow {
  votes: VoteRow[];
  my_vote?: VoteRow | null;
  vote_counts?: { [voted_for_user_id: string]: number };
}

interface GroupSummaryCommentsApiResponse extends OriginalCommentRow {
  username?: UserRow['username'];
}

interface GroupSummaryDetails {
  group: BrowsableGroupApiResponse;
  members: GroupMember[];
  questions: FrontendQuestion[];
  comments: GroupSummaryCommentsApiResponse[];
}

const PORTRAIT_ASPECT_RATIO = 4 / 3; // Height / Width

const GroupSummaryScreen: React.FC = () => {
  const router = useRouter();
  const { partyId, groupId } = useLocalSearchParams<{ partyId: string; groupId: string }>();

  const [summaryDetails, setSummaryDetails] = useState<GroupSummaryDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaryDetails = useCallback(async () => {
    if (!partyId || !groupId) {
      setError("Party ID or Group ID is missing");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [groupRes, membersRes, questionsRes, commentsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/group/${groupId}`),
        fetch(`${API_BASE_URL}/group/${groupId}/members`),
        fetch(`${API_BASE_URL}/group/${groupId}/questions`),
        fetch(`${API_BASE_URL}/group/${groupId}/comments`),
      ]);

      if (!groupRes.ok) throw new Error(`Failed to fetch group: ${groupRes.statusText} (${groupRes.status})`);
      const groupData: BrowsableGroupApiResponse = await groupRes.json();

      if (!membersRes.ok) throw new Error(`Failed to fetch members: ${membersRes.statusText} (${membersRes.status})`);
      const membersData: { members: GroupMember[]; count?: number } = await membersRes.json();
      const joinedMembers = membersData.members.filter(m => m.status === 'joined');

      if (!questionsRes.ok) throw new Error(`Failed to fetch questions: ${questionsRes.statusText} (${questionsRes.status})`);
      const questionsFromApi: (QuestionRow & { votes: VoteRow[] })[] = await questionsRes.json();

      const processedQuestions: FrontendQuestion[] = questionsFromApi.map(q => {
        const voteCounts: { [voted_for_user_id: string]: number } = {};
        (q.votes || []).forEach(vote => {
          voteCounts[vote.voted_for_user_id] = (voteCounts[vote.voted_for_user_id] || 0) + 1;
        });
        return {
          ...q,
          votes: q.votes || [],
          vote_counts: voteCounts,
        };
      });

      if (!commentsRes.ok) throw new Error(`Failed to fetch comments: ${commentsRes.statusText} (${commentsRes.status})`);
      const rawCommentsData: OriginalCommentRow[] = await commentsRes.json();

      const formattedComments: GroupSummaryCommentsApiResponse[] = await Promise.all(
        rawCommentsData.map(async c => {
          try {
            const userRes = await fetch(`${API_BASE_URL}/user/${c.user_id}`);
            if (!userRes.ok) {
                console.warn(`Failed to fetch user details for comment by ${c.user_id}: ${userRes.status}`);
                return { ...c, username: "Anonymous" };
            }
            const user: UserRow = await userRes.json();
            return { ...c, username: user.username || "Anonymous" };
          } catch (userFetchError) {
            console.warn(`Error fetching user details for comment by ${c.user_id}:`, userFetchError);
            return { ...c, username: "Anonymous" };
          }
        })
      );

      setSummaryDetails({
        group: groupData,
        members: joinedMembers,
        questions: processedQuestions,
        comments: formattedComments,
      });
    } catch (err: any) {
      console.error('Fetch Summary Details Error:', err);
      setError(err.message || 'Could not load group details.');
      setSummaryDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [partyId, groupId]);

  useEffect(() => {
    fetchSummaryDetails();
  }, [fetchSummaryDetails]);

  const getHeaderOptions = (title?: string) => ({
    headerStyle: { backgroundColor: AppColors.secondaryBg },
    headerTintColor: AppColors.white,
    headerTitle: title || "Group Details",
    headerTitleAlign: 'center' as 'center',
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.replace(`/party/${partyId}/groups/explore`)} style={{ marginLeft: Platform.OS === 'ios' ? 10 : 10, padding: 5 }}>
        <ArrowLeft size={24} color={AppColors.gray300} />
      </TouchableOpacity>
    ),
    headerShadowVisible: false,
  });

  if (isLoading) {
    return (
      <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]} style={styles.container}>
        <Stack.Screen options={getHeaderOptions()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.pink400} />
          <Text style={styles.loadingText}>Loading group details...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]} style={styles.container}>
        <Stack.Screen options={getHeaderOptions("Error")} />
        <View style={styles.errorContainer}>
          <LucideAlertCircle size={48} color={AppColors.red400} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchSummaryDetails}>
            <Text style={styles.refreshButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (!summaryDetails) {
    return (
      <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]} style={styles.container}>
        <Stack.Screen options={getHeaderOptions()} />
        <View style={styles.loadingContainer}>
          <Info size={48} color={AppColors.gray300} />
          <Text style={styles.loadingText}>No details to display.</Text>
        </View>
      </LinearGradient>
    );
  }

  const { group, members, questions, comments } = summaryDetails;
  return (
    <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]} style={styles.container}>
      <Stack.Screen options={getHeaderOptions(`${group.creator_username || 'A Crew'}'s Crew`)} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.summaryTitle} numberOfLines={2}>
          {`${group.creator_username || 'A Crew'}'s Crew`}
        </Text>

        {/* Members Section */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <Users size={20} color={AppColors.primary} />
            <Text style={styles.summarySectionTitle}>Members ({members.length})</Text>
          </View>
          {members.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryMembersScroll}>
              {members.map(member => (
                <View key={member.userId} style={styles.summaryMemberItemHorizontal}>
                  <Image
                    source={{ uri: `${API_BASE_URL}/user/${member.userId}/portrait` }}
                    style={styles.summaryMemberPortrait}
                    onError={(e) => console.warn(`Failed to load member portrait for ${member.userId}:`, e.nativeEvent.error)}
                  />
                  <Text style={styles.summaryMemberUsernameHorizontal} numberOfLines={1}>
                    {member.username || 'User'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyStateText}>No members currently in this group.</Text>
          )}
        </View>

        {/* "Most Likely To..." Section */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <HelpCircle size={20} color={AppColors.primary} />
            <Text style={styles.summarySectionTitle}>Most Likely To... ({questions.length})</Text>
          </View>
          {questions.length > 0 ? (
            questions.map((question, qIndex) => {
              const votesByTargetUser: Record<string, VoteRow[]> = {};
              (question.votes || []).forEach(vote => {
                if (!votesByTargetUser[vote.voted_for_user_id]) {
                  votesByTargetUser[vote.voted_for_user_id] = [];
                }
                votesByTargetUser[vote.voted_for_user_id].push(vote);
              });

              const membersWithVotesForThisQuestion = members.filter(
                member => votesByTargetUser[member.userId] && votesByTargetUser[member.userId].length > 0
              );
              
              const questionItemStyle = [
                styles.summaryQuestionItem,
                qIndex === questions.length - 1 && styles.summaryQuestionItemLast,
              ];

              return (
                <View key={question.question_id} style={questionItemStyle}>
                  <Text style={styles.summaryQuestionText}>{question.question_text}</Text>
                  {membersWithVotesForThisQuestion.length > 0 ? (
                    <View style={styles.questionVotesContainer}>
                      {membersWithVotesForThisQuestion.map(targetMember => {
                        const votersForThisTarget = votesByTargetUser[targetMember.userId] || [];
                        if (votersForThisTarget.length === 0) return null; 

                        return (
                          <View key={targetMember.userId} style={styles.memberVoteColumn}>
                            <Image
                              source={{ uri: `${API_BASE_URL}/user/${targetMember.userId}/profile-picture` }}
                              style={styles.votedForMemberPortrait}
                              onError={(e) => console.warn(`PFP load fail (voted for portrait): ${targetMember.userId}`, e.nativeEvent.error)}
                            />
                            <Text style={styles.votedForMemberUsername} numberOfLines={1}>{targetMember.username || 'User'}</Text>
                            <View style={styles.voterPfPContainer}>
                              {votersForThisTarget.map(vote => {
                                const voterDetails = members.find(m => m.userId === vote.voter_user_id);
                                if (!voterDetails) return null; 

                                return (
                                  <Image
                                    key={vote.vote_id}
                                    source={{ uri: `${API_BASE_URL}/user/${voterDetails.userId}/profile-picture` }}
                                    style={styles.voterPortraitSmall}
                                    onError={(e) => console.warn(`PFP load fail (voter portrait): ${voterDetails.userId}`, e.nativeEvent.error)}
                                  />
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.emptyStateTextSmall}>
                      {question.votes && question.votes.length > 0 ? "Votes are for members not currently in this view." : "No votes yet for this question."}
                    </Text>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyStateText}>No "Most Likely To" questions found for this group.</Text>
          )}
        </View>

        {/* Comments Section */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <MessageSquare size={20} color={AppColors.primary} />
            <Text style={styles.summarySectionTitle}>Comments ({comments.length})</Text>
          </View>
          {comments.length > 0 ? (
            comments.map((comment, cIndex) => (
              <View 
                key={comment.comment_id} 
                style={[
                  styles.summaryCommentItem,
                  cIndex === comments.length -1 && styles.summaryCommentItemLast
                ]}
              >
                <Image
                  source={{ uri: `${API_BASE_URL}/user/${comment.user_id}/portrait` }}
                  style={styles.summaryCommenterPortrait}
                  onError={(e) => console.warn(`PFP load fail (commenter portrait): ${comment.user_id}`, e.nativeEvent.error)}
                />
                <View style={styles.summaryCommentContent}>
                  <Text style={styles.summaryCommenterUsername}>{comment.username}</Text>
                  <Text style={styles.summaryCommentText}>{comment.comment_text}</Text>
                  {comment.created_at && (
                    <Text style={styles.summaryCommentTimestamp}>
                      {new Date(comment.created_at).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateText}>No comments for this group yet.</Text>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

// --- STYLES ---
// Increased base widths for portraits
const memberPortraitWidth = 100;         // Was 56
const votedForPortraitWidth = 60;       // Was 52
const voterPortraitSmallWidth = 30;     // Was 26
const commenterPortraitWidth = 48;      // Was 42

const portraitBorderRadius = 10;        // Increased for larger feel, was 8
const smallPortraitBorderRadius = 6;    // Increased for larger feel, was 4

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: AppColors.white,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: AppColors.red400,
    fontSize: 17,
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  refreshButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
    minWidth: '60%',
    alignItems: 'center',
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  refreshButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: AppColors.white,
    textAlign: 'center',
    marginBottom: 30,
  },
  summarySection: {
    backgroundColor: AppColors.cardBg || AppColors.darkerBg,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 5,
    marginBottom: 20,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  summarySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray700 || '#444',
  },
  summarySectionTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: AppColors.primary,
    marginLeft: 10,
  },
  summaryMembersScroll: {
    paddingVertical: 10,
  },
  summaryMemberItemHorizontal: {
    alignItems: 'center',
    marginRight: 20, // Increased spacing for larger portraits
    width: memberPortraitWidth + 10, // Adjusted for new width and some padding
  },
  summaryMemberPortrait: {
    width: memberPortraitWidth,
    height: Math.round(memberPortraitWidth * PORTRAIT_ASPECT_RATIO),
    borderRadius: portraitBorderRadius,
    backgroundColor: AppColors.gray500,
    marginBottom: 8, // Increased space below portrait
  },
  summaryMemberUsernameHorizontal: {
    color: AppColors.gray200,
    fontSize: 13, // Slightly larger username
    textAlign: 'center',
  },
  summaryQuestionItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray600 || '#555',
  },
  summaryQuestionItemLast: {
    borderBottomWidth: 0,
  },
  summaryQuestionText: {
    color: AppColors.gray100,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    marginBottom: 15,
  },
  questionVotesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 5,
  },
  memberVoteColumn: {
    alignItems: 'center',
    marginRight: 12, // Increased spacing between columns
    marginBottom: 18, // Increased bottom margin
    width: screenWidth / 3 - 25, // Adjusted for potentially 3 columns, or allow flexWrap to handle
    minWidth: votedForPortraitWidth + 20, // Min width based on portrait + text space
  },
  votedForMemberPortrait: {
    width: votedForPortraitWidth,
    height: Math.round(votedForPortraitWidth * PORTRAIT_ASPECT_RATIO),
    borderRadius: portraitBorderRadius,
    backgroundColor: AppColors.gray500,
    borderWidth: 2,
    borderColor: AppColors.pink400,
  },
  votedForMemberUsername: {
    fontSize: 13, // Slightly larger username
    color: AppColors.white,
    marginTop: 8, // Increased space
    fontWeight: '600',
    textAlign: 'center',
  },
  voterPfPContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10, // Increased space
    minHeight: Math.round(voterPortraitSmallWidth * PORTRAIT_ASPECT_RATIO) + 6,
    width: '100%',
  },
  voterPortraitSmall: {
    width: voterPortraitSmallWidth,
    height: Math.round(voterPortraitSmallWidth * PORTRAIT_ASPECT_RATIO),
    borderRadius: smallPortraitBorderRadius,
    backgroundColor: AppColors.gray600,
    borderWidth: 1,
    borderColor: AppColors.gray400,
    marginHorizontal: 3, // Slightly more space
    marginTop: 4, // Slightly more space
  },
  summaryCommentItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray600 || '#555',
  },
  summaryCommentItemLast: {
    borderBottomWidth: 0,
  },
  summaryCommenterPortrait: {
    width: commenterPortraitWidth,
    height: Math.round(commenterPortraitWidth * PORTRAIT_ASPECT_RATIO),
    borderRadius: portraitBorderRadius - 2, // Adjusted radius based on new portraitBorderRadius
    backgroundColor: AppColors.gray500,
    marginRight: 15, // Increased margin
    borderWidth: 1,
    borderColor: AppColors.gray700,
  },
  summaryCommentContent: {
    flex: 1,
  },
  summaryCommenterUsername: {
    color: AppColors.primary,
    fontWeight: 'bold',
    fontSize: 15.5, // Slightly larger
    marginBottom: 4,
  },
  summaryCommentText: {
    color: AppColors.gray200,
    fontSize: 15, // Slightly larger
    lineHeight: 22, // Adjusted line height
    marginBottom: 6,
  },
  summaryCommentTimestamp: {
    color: AppColors.gray400,
    fontSize: 12, // Slightly larger
  },
  emptyStateText: {
    color: AppColors.gray300,
    fontSize: 14.5,
    textAlign: 'center',
    paddingVertical: 25,
    fontStyle: 'italic',
  },
   emptyStateTextSmall: {
    color: AppColors.gray400,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
    fontStyle: 'italic',
  },
});

export default GroupSummaryScreen;