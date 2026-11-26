from decimal import Decimal
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from .models import Wallet, Transaction
from .serializers import WalletSerializer, TopUpWalletInputSerializer

MAX_WALLET_BALANCE = Decimal('10000.00')
DAILY_TOPUP_LIMIT = Decimal('5000.00')


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
        amount = Decimal(str(serializer.validated_data['amount']))

        wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
        current_balance = Decimal(str(wallet.balance))

        if current_balance + amount > MAX_WALLET_BALANCE:
            return Response(
                {'error': f'تجاوز الحد الأقصى لرصيد المحفظة ({MAX_WALLET_BALANCE} {wallet.currency})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        today = timezone.now().date()
        daily_topups = Transaction.objects.filter(
            wallet=wallet,
            transaction_type=Transaction.Types.TOPUP,
            created_at__date=today
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        if Decimal(str(daily_topups)) + amount > DAILY_TOPUP_LIMIT:
            return Response(
                {'error': f'تجاوز الحد اليومي التراكمي لشحن المحفظة ({DAILY_TOPUP_LIMIT} {wallet.currency})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        wallet.balance = current_balance + amount
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
