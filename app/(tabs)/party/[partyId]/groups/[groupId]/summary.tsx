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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, AlertCircle, Info, Users, MessageSquare } from 'lucide-react-native';
import Colors, { API_BASE_URL } from '@/constants';
import { LinearGradient } from 'expo-linear-gradient';
import { GroupRow, UserRow, QuestionRow, VoteRow, CommentRow as OriginalCommentRow } from '@/types/database';

const AppColors = Colors.dark;
const { width: screenWidth } = Dimensions.get('window');

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

  const CustomHeader = ({ title }: { title: string }) => (
    <View style={headerStyles.headerContainer}>
      <TouchableOpacity onPress={() => router.replace(`/party/${partyId}/groups/explore`)} style={headerStyles.backButton}>
        <ArrowLeft size={24} color={AppColors.gray300} />
      </TouchableOpacity>
      <Text style={headerStyles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={headerStyles.rightPlaceholder} />
    </View>
  );

  if (isLoading) {
    return (
      <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]} style={styles.container}>
        <CustomHeader title="Loading Group" />
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
        <CustomHeader title="Error" />
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={AppColors.red400} />
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
        <CustomHeader title="No Details" />
        <View style={styles.loadingContainer}>
          <Info size={48} color={AppColors.gray300} />
          <Text style={styles.loadingText}>No details to display.</Text>
        </View>
      </LinearGradient>
    );
  }

  const { group, members, comments } = summaryDetails;
  
  return (
    <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]} style={styles.container}>
      <CustomHeader title={`${group.creator_username || 'A Group'}'s Group`} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Members Section */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <Users size={20} color={AppColors.primary} />
            <Text style={styles.summarySectionTitle}>
              Members ({members.length})
            </Text>
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
            <Text style={styles.emptyStateText}>
              No members currently in this group.
            </Text>
          )}
        </View>

        {/* Comments Section */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <MessageSquare size={20} color={AppColors.primary} />
            <Text style={styles.summarySectionTitle}>
              Comments ({comments.length})
            </Text>
          </View>
          {comments.length > 0 ? (
            comments.map((comment, cIndex) => (
              <View
                key={comment.comment_id}
                style={[
                  styles.summaryCommentItem,
                  cIndex === comments.length - 1 && styles.summaryCommentItemLast
                ]}
              >
                <Image
                  source={{ uri: `${API_BASE_URL}/user/${comment.user_id}/portrait` }}
                  style={styles.summaryCommenterPortrait}
                  onError={(e) => console.warn(`PFP load fail (commenter portrait): ${comment.user_id}`, e.nativeEvent.error)}
                />
                <View style={styles.summaryCommentContent}>
                  <Text style={styles.summaryCommenterUsername}>
                    {comment.username}
                  </Text>
                  <Text style={styles.summaryCommentText}>
                    {comment.comment_text}
                  </Text>
                  {comment.created_at && (
                    <Text style={styles.summaryCommentTimestamp}>
                      {new Date(comment.created_at).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateText}>
              No comments for this group yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

// --- Custom Header Styles ---
const headerStyles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.secondaryBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.gray600,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    color: AppColors.white,
    fontSize: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  rightPlaceholder: {
    width: 24 + 10,
  },
});

// --- STYLES ---
const memberPortraitWidth = 100;
const commenterPortraitWidth = 48;
const portraitBorderRadius = 10;

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
    marginRight: 20,
    width: memberPortraitWidth + 10,
  },
  summaryMemberPortrait: {
    width: memberPortraitWidth,
    height: Math.round(memberPortraitWidth * PORTRAIT_ASPECT_RATIO),
    borderRadius: portraitBorderRadius,
    backgroundColor: AppColors.gray500,
    marginBottom: 8,
  },
  summaryMemberUsernameHorizontal: {
    color: AppColors.gray200,
    fontSize: 13,
    textAlign: 'center',
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
    borderRadius: portraitBorderRadius - 2,
    backgroundColor: AppColors.gray500,
    marginRight: 15,
    borderWidth: 1,
    borderColor: AppColors.gray700,
  },
  summaryCommentContent: {
    flex: 1,
  },
  summaryCommenterUsername: {
    color: AppColors.primary,
    fontWeight: 'bold',
    fontSize: 15.5,
    marginBottom: 4,
  },
  summaryCommentText: {
    color: AppColors.gray200,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  summaryCommentTimestamp: {
    color: AppColors.gray400,
    fontSize: 12,
  },
  emptyStateText: {
    color: AppColors.gray300,
    fontSize: 14.5,
    textAlign: 'center',
    paddingVertical: 25,
    fontStyle: 'italic',
  },
});

export default GroupSummaryScreen;