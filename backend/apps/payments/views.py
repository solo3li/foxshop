from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from .models import Wallet, Transaction
from .serializers import WalletSerializer, TopUpWalletInputSerializer

class CustomerWalletView(generics.RetrieveAPIView):
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        wallet, _ = Wallet.objects.get_or_create(user=self.request.user)
        return wallet


class CustomerTopUpWalletView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = TopUpWalletInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data['amount']

        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        wallet.balance += amount
        wallet.save(update_fields=['balance', 'updated_at'])

        Transaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type=Transaction.Types.TOPUP,
            reference_id="SIMULATED-PAYMENT",
            description=f"شحن رصيد المحفظة بمبلغ {amount} {wallet.currency}"
        )

        return Response({
            'message': f'تم شحن المحفظة بمبلغ {amount} {wallet.currency} بنجاح',
            'wallet': WalletSerializer(wallet).data
        }, status=status.HTTP_200_OK)
