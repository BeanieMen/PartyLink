
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants';

const AppColors = Colors.dark;

interface InfoPopupProps {
    isVisible: boolean;
    onClose: () => void;
    title: string;
    content: React.ReactNode;
}

const InfoPopup: React.FC<InfoPopupProps> = ({ isVisible, onClose, title, content }) => {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <LinearGradient
                    colors={[AppColors.cardBg || '#3A205E', AppColors.primaryBg || '#2C154F']}
                    style={styles.modalView}
                >
                    <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
                        <X size={24} color={AppColors.gray300 || '#8E8E93'} />
                    </TouchableOpacity>

                    <Text style={styles.modalTitle}>{title}</Text>

                    {content}

                    <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
                        <Text style={styles.gotItButtonText}>Got It!</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalView: {
        margin: 20,
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: Dimensions.get('window').width * 0.85,
        maxWidth: 400,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        padding: 5,
        zIndex: 1,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: AppColors.white || '#FFFFFF',
    },
    gotItButton: {
        backgroundColor: AppColors.pink400 || '#FF007A',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 25,
        marginTop: 15,
        shadowColor: AppColors.pink400 || '#FF007A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    gotItButtonText: {
        color: AppColors.white || '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 18,
    },
});

export default InfoPopup;